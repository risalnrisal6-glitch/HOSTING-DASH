import { Router } from "express";
import multer from "multer";
import { asyncH, ApiError } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody, limitsSchema, featureLimitsSchema } from "../lib/validate";
import * as serverSvc from "../services/server.service";
import * as ptero from "../lib/pterodactyl";
import { prisma } from "../db";
import { settings } from "../services/settings";
import { audit } from "../lib/audit";
import { isPanelConnected } from "../lib/pterodactyl";
import { isStaff } from "../lib/rbac";

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================================
// Wizard data — everything fetched dynamically from the panel
// (or demo provider), never hardcoded.
// ============================================================

router.get(
  "/wizard-data",
  asyncH(async (req, res) => {
    const [nests, nodes, locations, shop, defaults] = await Promise.all([
      ptero.getNests(),
      ptero.getNodes(),
      ptero.getLocations(),
      (await import("../services/store.service")).listShopItems(),
      settings.getAll(),
    ]);
    const slots = await serverSvc.getUserServerSlots((req as AuthedRequest).user.id);
    res.json({
      ok: true,
      data: {
        nests: nests.map((n: any) => ({ id: n.id, uuid: n.uuid, name: n.name, description: n.description })),
        nodes,
        locations,
        shop,
        slots,
        connected: await isPanelConnected(),
        defaults: {
          node: defaults.default_node,
          location: defaults.default_location,
          nest: defaults.default_nest,
          egg: defaults.default_egg,
          dockerImage: defaults.default_docker_image,
        },
      },
    });
  })
);

router.get(
  "/eggs/:nestId",
  asyncH(async (req, res) => {
    const eggs = await ptero.getEggs(req.params.nestId);
    res.json({
      ok: true,
      data: eggs.map((e: any) => ({ id: e.id, uuid: e.uuid, name: e.name, description: e.description, docker_images: e.docker_images ?? [], startup: e.startup })),
    });
  })
);

router.get(
  "/eggs/:nestId/:eggId",
  asyncH(async (req, res) => {
    const egg = await ptero.getEgg(req.params.nestId, req.params.eggId);
    const variables = (egg.variables ?? []).filter((v: any) => v.user_viewable);
    res.json({
      ok: true,
      data: {
        id: egg.id,
        uuid: egg.uuid,
        name: egg.name,
        description: egg.description,
        docker_images: egg.docker_images ?? [],
        startup: egg.startup,
        features: egg.features ?? [],
        variables: variables.map((v: any) => ({
          name: v.name,
          description: v.description,
          env_variable: v.env_variable,
          default_value: v.default_value ?? "",
          user_editable: v.user_editable,
          rules: v.rules,
        })),
      },
    });
  })
);

// ============================================================
// Server CRUD
// ============================================================

router.get(
  "/",
  asyncH(async (req, res) => {
    const servers = await serverSvc.listUserServers((req as AuthedRequest).user.id, String(req.query.search || ""));
    const withUsage = await Promise.all(
      servers.map(async (s) => {
        let usage = null;
        try {
          usage = await serverSvc.serverStats(s);
        } catch {
          usage = null;
        }
        return { ...s, usage };
      })
    );
    res.json({ ok: true, data: withUsage });
  })
);

router.post(
  "/",
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        name: z.string().min(1).max(64),
        description: z.string().max(255).optional(),
        nestId: z.string().optional(),
        eggId: z.string().optional(),
        dockerImage: z.string().optional(),
        locationId: z.string().optional(),
        nodeId: z.string().optional(),
        limits: limitsSchema,
        featureLimits: featureLimitsSchema,
        startup: z.string().optional(),
        environment: z.record(z.string()).optional(),
      }),
      req
    );
    const server = await serverSvc.createServerForUser((req as AuthedRequest).user.id, data);
    await audit(req, "server.create", "server", server.id, { name: server.name });
    res.status(201).json({ ok: true, data: server });
  })
);

router.delete(
  "/:id",
  asyncH(async (req, res) => {
    const server = await serverSvc.deleteServerForUser((req as AuthedRequest).user, req.params.id, isStaff(req));
    await audit(req, "server.delete", "server", server.id, { name: server.name });
    res.json({ ok: true, data: { id: server.id } });
  })
);

// ============================================================
// Per-server management
// ============================================================

async function loadServer(req: any) {
  const user = (req as AuthedRequest).user;
  return serverSvc.getUserServer(user.id, req.params.id, isStaff(req));
}

router.get(
  "/:id",
  asyncH(async (req, res) => {
    const server = await loadServer(req);
    const [stats, allocations, sftp] = await Promise.all([
      serverSvc.serverStats(server),
      ptero.network.allocations(server).catch(() => []),
      ptero.getSftp(server).catch(() => null),
    ]);
    res.json({ ok: true, data: { server, stats, allocations, sftp } });
  })
);

// ---- Stats ----
router.get(
  "/:id/stats",
  asyncH(async (req, res) => {
    const server = await loadServer(req);
    const stats = await serverSvc.serverStats(server);
    res.json({ ok: true, data: stats });
  })
);

// ---- Power ----
router.post(
  "/:id/power",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ signal: z.enum(["start", "stop", "restart", "kill"]) }), req);
    const server = await loadServer(req);
    if (server.status === "SUSPENDED") throw ApiError.forbidden("Server is suspended");
    await ptero.setPower(server, data.signal);
    await audit(req, `server.power.${data.signal}`, "server", server.id);
    res.json({ ok: true });
  })
);

// ---- Console: send command ----
router.post(
  "/:id/command",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ command: z.string().max(255) }), req);
    const server = await loadServer(req);
    await ptero.sendCommand(server, data.command);
    await audit(req, "server.command", "server", server.id, { command: data.command.slice(0, 60) });
    res.json({ ok: true });
  })
);

// ---- Console: SSE stream ----
router.get("/:id/console/stream", asyncH(async (req, res) => {
  const server = await loadServer(req);

  if (!(await isPanelConnected())) {
    throw ApiError.badRequest(
      "Console requires a Pterodactyl panel connection. Go to Admin → Settings → Pterodactyl API to configure one."
    );
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ status: server.status, name: server.name })}\n\n`);

  let ws: any = null;
  let closed = false;

  const send = (event: string, payload: unknown) => {
    if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const wsData = await (await import("../lib/pterodactyl/client-api")).clientApi.getWebsocket(server.uuid);
    const WebSocket = (await import("ws")).default;
    ws = new WebSocket(wsData.socket);
    ws.on("open", () => ws.send(JSON.stringify({ event: "auth", args: [wsData.token] })));
    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === "console output" && msg.args?.[0]) send("output", { line: msg.args[0] });
        if (msg.event === "status") send("status", { state: msg.args?.[0] });
        if (msg.event === "stats") {
          try { send("stats", JSON.parse(msg.args?.[0])); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    });
  } catch (e) {
    send("notice", { message: "Console stream unavailable from panel: " + (e instanceof Error ? e.message : e) });
  }

  req.on("close", () => {
    closed = true;
    if (ws) try { ws.close(); } catch { /* ignore */ }
  });
}));

// ---- Files ----
router.get("/:id/files", asyncH(async (req, res) => {
  const server = await loadServer(req);
  const directory = String(req.query.directory || "/");
  const files = await ptero.files.list(server, directory);
  res.json({ ok: true, data: { directory, files } });
}));

router.get("/:id/files/content", asyncH(async (req, res) => {
  const server = await loadServer(req);
  const content = await ptero.files.read(server, String(req.query.file || ""));
  res.json({ ok: true, data: { content } });
}));

router.post("/:id/files/write", asyncH(async (req, res) => {
  const data = validateBody(z.object({ file: z.string().min(1), content: z.string() }), req);
  const server = await loadServer(req);
  await ptero.files.write(server, data.file, data.content);
  await audit(req, "server.file.write", "server", server.id, { file: data.file });
  res.json({ ok: true });
}));

router.post("/:id/files/delete", asyncH(async (req, res) => {
  const data = validateBody(z.object({ root: z.string(), files: z.array(z.string()).min(1) }), req);
  const server = await loadServer(req);
  await ptero.files.delete(server, data.root, data.files);
  res.json({ ok: true });
}));

router.post("/:id/files/rename", asyncH(async (req, res) => {
  const data = validateBody(z.object({ root: z.string(), files: z.array(z.object({ from: z.string(), to: z.string() })).min(1) }), req);
  const server = await loadServer(req);
  await ptero.files.rename(server, data.root, data.files);
  res.json({ ok: true });
}));

router.post("/:id/files/copy", asyncH(async (req, res) => {
  const data = validateBody(z.object({ location: z.string(), name: z.string() }), req);
  const server = await loadServer(req);
  const result = await ptero.files.copy(server, data.location, data.name);
  res.json({ ok: true, data: result });
}));

router.post("/:id/files/mkdir", asyncH(async (req, res) => {
  const data = validateBody(z.object({ root: z.string(), name: z.string() }), req);
  const server = await loadServer(req);
  await ptero.files.createDirectory(server, data.root, data.name);
  res.json({ ok: true });
}));

router.post("/:id/files/compress", asyncH(async (req, res) => {
  const data = validateBody(z.object({ root: z.string(), files: z.array(z.string()).min(1) }), req);
  const server = await loadServer(req);
  const result = await ptero.files.compress(server, data.root, data.files);
  res.json({ ok: true, data: result });
}));

router.post("/:id/files/decompress", asyncH(async (req, res) => {
  const data = validateBody(z.object({ root: z.string(), file: z.string() }), req);
  const server = await loadServer(req);
  await ptero.files.decompress(server, data.root, data.file);
  res.json({ ok: true });
}));

router.post("/:id/files/upload", upload.single("file"), asyncH(async (req, res) => {
  const server = await loadServer(req);
  const directory = String(req.body.directory || "/");
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  await ptero.files.upload(server, directory, req.file.buffer, req.file.originalname);
  await audit(req, "server.file.upload", "server", server.id, { name: req.file.originalname, size: req.file.size });
  res.json({ ok: true });
}));

router.get("/:id/files/download", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.files.download(res, server, String(req.query.file || ""));
}));

// ---- SFTP ----
router.get("/:id/sftp", asyncH(async (req, res) => {
  const server = await loadServer(req);
  res.json({ ok: true, data: await ptero.getSftp(server) });
}));

// ---- Startup / environment ----
router.get("/:id/startup", asyncH(async (req, res) => {
  const server = await loadServer(req);
  res.json({ ok: true, data: await ptero.getStartup(server) });
}));

router.post("/:id/startup", asyncH(async (req, res) => {
  const data = validateBody(z.object({ startup: z.string().optional(), environment: z.record(z.string()).optional() }), req);
  const server = await loadServer(req);
  await ptero.updateStartup(server, data);
  await audit(req, "server.startup", "server", server.id);
  res.json({ ok: true });
}));

// ---- Backups ----
router.get("/:id/backups", asyncH(async (req, res) => {
  const server = await loadServer(req);
  res.json({ ok: true, data: await ptero.backups.list(server) });
}));

router.post("/:id/backups", asyncH(async (req, res) => {
  const data = validateBody(z.object({ name: z.string().max(64).optional() }), req);
  const server = await loadServer(req);
  const backup = await ptero.backups.create(server, data.name);
  await audit(req, "server.backup.create", "server", server.id);
  res.status(201).json({ ok: true, data: backup });
}));

router.post("/:id/backups/:backupId/restore", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.backups.restore(server, req.params.backupId);
  await audit(req, "server.backup.restore", "server", server.id);
  res.json({ ok: true });
}));

router.delete("/:id/backups/:backupId", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.backups.delete(server, req.params.backupId);
  await audit(req, "server.backup.delete", "server", server.id);
  res.json({ ok: true });
}));

router.get("/:id/backups/:backupId/download", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.backups.download(res, server, req.params.backupId);
}));

// ---- Databases ----
router.get("/:id/databases", asyncH(async (req, res) => {
  const server = await loadServer(req);
  const rows = await ptero.databases.list(server);
  const sftp = await ptero.getSftp(server).catch(() => null);
  res.json({ ok: true, data: { rows, sftp } });
}));

router.post("/:id/databases", asyncH(async (req, res) => {
  const data = validateBody(z.object({ database: z.string().min(1).max(48), remote: z.string().default("%") }), req);
  const server = await loadServer(req);
  const result = await ptero.databases.create(server, data.database, data.remote);
  await audit(req, "server.db.create", "server", server.id, { database: data.database });
  res.status(201).json({ ok: true, data: result });
}));

router.post("/:id/databases/:dbId/reset-password", asyncH(async (req, res) => {
  const server = await loadServer(req);
  const result = await ptero.databases.resetPassword(server, req.params.dbId);
  res.json({ ok: true, data: result });
}));

router.delete("/:id/databases/:dbId", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.databases.delete(server, req.params.dbId);
  await audit(req, "server.db.delete", "server", server.id);
  res.json({ ok: true });
}));

// ---- Network ----
router.get("/:id/network", asyncH(async (req, res) => {
  const server = await loadServer(req);
  res.json({ ok: true, data: await ptero.network.allocations(server) });
}));

router.post("/:id/network", asyncH(async (req, res) => {
  const server = await loadServer(req);
  const alloc = await ptero.network.create(server);
  await audit(req, "server.alloc.create", "server", server.id);
  res.status(201).json({ ok: true, data: alloc });
}));

router.post("/:id/network/:allocationId/primary", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.network.setPrimary(server, req.params.allocationId);
  res.json({ ok: true });
}));

router.delete("/:id/network/:allocationId", asyncH(async (req, res) => {
  const server = await loadServer(req);
  await ptero.network.delete(server, req.params.allocationId);
  await audit(req, "server.alloc.delete", "server", server.id);
  res.json({ ok: true });
}));

// ---- Rename ----
router.patch("/:id", asyncH(async (req, res) => {
  const data = validateBody(z.object({ name: z.string().min(1).max(64).optional(), description: z.string().max(255).optional() }), req);
  const server = await loadServer(req);
  const updated = await prisma.server.update({
    where: { id: server.id },
    data: { ...(data.name ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description } : {}) },
  });
  await audit(req, "server.rename", "server", server.id, { name: data.name });
  res.json({ ok: true, data: updated });
}));

export default router;
