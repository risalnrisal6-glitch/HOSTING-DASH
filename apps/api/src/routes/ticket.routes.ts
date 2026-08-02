import { Router } from "express";
import multer from "multer";
import { asyncH, ApiError } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody } from "../lib/validate";
import * as ticketSvc from "../services/ticket.service";
import { isStaff } from "../lib/rbac";
import { paths } from "../config";
import { randomToken } from "../lib/crypto";
import { audit } from "../lib/audit";
import path from "path";
import fs from "fs";

const router = Router();
router.use(requireAuth);

// Attachments stored under data/uploads (served by the static handler)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post(
  "/upload",
  upload.array("files", 5),
  asyncH(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const saved = files.map((f) => {
      const name = `${randomToken(6)}-${path.basename(f.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const dir = paths.uploads;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), f.buffer);
      return { name: f.originalname, url: `/uploads/${name}` };
    });
    res.json({ ok: true, data: saved });
  })
);

router.get(
  "/",
  asyncH(async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 10), 50);
    const status = String(req.query.status || "all");
    res.json({ ok: true, data: await ticketSvc.listTickets((req as AuthedRequest).user.id, page, limit, status) });
  })
);

router.post(
  "/",
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        subject: z.string().min(3).max(120),
        category: z.string().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        body: z.string().min(5).max(5000),
        attachments: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
      }),
      req
    );
    const ticket = await ticketSvc.createTicket((req as AuthedRequest).user.id, data);
    await audit(req, "ticket.create", "ticket", ticket.id);
    res.status(201).json({ ok: true, data: ticket });
  })
);

router.get(
  "/:id",
  asyncH(async (req, res) => {
    const ticket = await ticketSvc.getTicket((req as AuthedRequest).user.id, req.params.id, isStaff(req));
    res.json({ ok: true, data: ticket });
  })
);

router.post(
  "/:id/reply",
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        body: z.string().min(1).max(5000),
        attachments: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
        isInternal: z.boolean().optional(),
      }),
      req
    );
    const user = (req as AuthedRequest).user;
    const message = await ticketSvc.replyToTicket(user, req.params.id, data.body, data.attachments, data.isInternal);
    await audit(req, "ticket.reply", "ticket", req.params.id);
    res.status(201).json({ ok: true, data: message });
  })
);

router.post(
  "/:id/status",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ status: z.enum(["open", "answered", "closed"]) }), req);
    const user = (req as AuthedRequest).user;
    const ticket = await ticketSvc.setTicketStatus(user, req.params.id, data.status);
    await audit(req, `ticket.status.${data.status}`, "ticket", req.params.id);
    res.json({ ok: true, data: ticket });
  })
);

router.post(
  "/:id/note",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ note: z.string().max(2000) }), req);
    const user = (req as AuthedRequest).user;
    const ticket = await ticketSvc.setInternalNote(user, req.params.id, data.note);
    await audit(req, "ticket.note", "ticket", req.params.id);
    res.json({ ok: true, data: ticket });
  })
);

export default router;
