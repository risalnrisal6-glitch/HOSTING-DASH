import { Response } from "express";
import { appApi } from "./app-api";
import { clientApi } from "./client-api";
import { settings } from "../../services/settings";
import { ApiError } from "../errors";
import { prisma } from "../../db";
import { cache } from "../cache";
import type { Server as DbServer } from "@prisma/client";

// ============================================================
// Pterodactyl panel facade.
// REQUIRES a configured panel (panel_url + panel_app_key set in
// Admin → Settings). Every operation throws with a clear error
// if the panel is not connected.
// ============================================================

type ServerRow = DbServer & { user?: { username: string } | null };

function parseLimits(server: ServerRow): Record<string, number> {
  try {
    return JSON.parse(server.limits || "{}");
  } catch {
    return {};
  }
}

/** Throws a helpful error if the panel is not configured. */
async function requirePanel(): Promise<void> {
  if (!(await settings.isPanelConfigured())) {
    throw ApiError.badRequest(
      "Panel is not connected. Go to Admin → Settings → Pterodactyl API, configure your panel URL and API keys, then enable the live connection."
    );
  }
}

export async function isPanelConnected(): Promise<boolean> {
  return settings.isPanelConfigured();
}

export async function testConnection(url: string, appKey: string, clientKey: string): Promise<{ nodes: number; users: number; servers: number; client: boolean }> {
  const prev = await settings.panelConfig();
  await settings.setMany({
    panel_enabled: true,
    panel_url: url.replace(/\/+$/, ""),
    panel_app_key: appKey,
    panel_client_key: clientKey,
  });
  try {
    const stats = await appApi.testConnection();
    let client = false;
    if (clientKey) {
      try {
        const res = await clientApi.request("GET", "/");
        client = Array.isArray(res?.data) || !!res?.object;
      } catch {
        client = false;
      }
    }
    return { ...stats, client };
  } finally {
    await settings.setMany({
      panel_url: prev.url,
      panel_app_key: prev.appKey,
      panel_client_key: prev.clientKey,
    });
  }
}

// ---------- Discovery ----------

export async function getNests(force = false) {
  await requirePanel();
  const ttl = force ? 0 : 600;
  if (!force) {
    const cached = await cache.getJson<any[]>("ptero:nests");
    if (cached) return cached;
  }
  const nests = await appApi.getNests();
  const withEggs = [];
  for (const nest of nests) {
    const eggs = await appApi.getEggs(nest.id);
    withEggs.push({ ...nest, eggs });
  }
  await cache.setJson("ptero:nests", withEggs, ttl || 600);
  return withEggs;
}

export async function getEgg(nestId: string | number, eggId: string | number) {
  await requirePanel();
  return appApi.getEgg(nestId, eggId);
}

export async function getEggs(nestId: string | number) {
  await requirePanel();
  return appApi.getEggs(nestId);
}

export async function getNodes() {
  await requirePanel();
  return appApi.getNodes();
}

export async function getLocations() {
  await requirePanel();
  return appApi.getLocations();
}

export async function getNodeAllocations(nodeId: string | number) {
  await requirePanel();
  return appApi.getNodeAllocations(nodeId, "per_page=100");
}

/** Full sync payload for the admin panel (eggs & nests discovery). */
export async function syncPanelData() {
  await requirePanel();
  const [nests, nodes, locations] = await Promise.all([getNests(true), getNodes(), getLocations()]);
  return { nests, nodes, locations, connected: true };
}

// ---------- Server creation ----------

export interface CreateServerInput {
  name: string;
  nodeId: string;
  locationId: string;
  nestId: string;
  eggId: string;
  dockerImage: string;
  limits: { ram: number; swap: number; disk: number; io: number; cpu: number };
  featureLimits: { databases: number; allocations: number; backups: number };
  startup?: string;
  environment?: Record<string, string>;
}

export async function createServer(owner: { email: string; username: string }, input: CreateServerInput): Promise<{ externalId: string | null; uuid: string }> {
  await requirePanel();

  // Find or create the panel user for this account
  let panelUser = await appApi.findUserByEmail(owner.email);
  if (!panelUser) {
    panelUser = await appApi.createUser({
      email: owner.email,
      username: owner.username,
      first_name: owner.username,
      last_name: "",
    });
  }

  // Find a free allocation on the target node
  const allocs = await appApi.getNodeAllocations(input.nodeId, "per_page=100");
  const free = allocs.find((a: any) => !a.assigned);
  if (!free) throw ApiError.badRequest("No free allocations on the selected node");

  const body = {
    name: input.name,
    user: panelUser.id,
    egg: Number(input.eggId),
    docker_image: input.dockerImage,
    startup: input.startup,
    environment: input.environment ?? {},
    limits: input.limits,
    feature_limits: input.featureLimits,
    allocation: {
      default: Number(free.id),
    },
  };
  const created = await appApi.createServer(body);
  const uuid = created?.uuid ?? created?.identifier;
  return { externalId: String(created.id), uuid };
}

// ---------- Runtime ----------

export async function getResources(server: ServerRow) {
  await requirePanel();
  if (!server.externalId) throw ApiError.badRequest("Server has no panel ID");
  const res = await clientApi.getResources(server.uuid);
  return {
    state: res.current_state,
    cpu: res.resources.cpu_absolute,
    memory_bytes: res.resources.memory_bytes,
    disk_bytes: res.resources.disk_bytes,
    network_rx_bytes: res.resources.network_rx_bytes,
    network_tx_bytes: res.resources.network_tx_bytes,
    uptime_seconds: res.resources.uptime ?? 0,
  };
}

export async function setPower(server: ServerRow, signal: "start" | "stop" | "restart" | "kill") {
  await requirePanel();
  await clientApi.power(server.uuid, signal);
  const status = signal === "start" || signal === "restart" ? "RUNNING" : "OFFLINE";
  await prisma.server.update({ where: { id: server.id }, data: { status, lastStartAt: status === "RUNNING" ? new Date() : null } });
}

export async function sendCommand(server: ServerRow, command: string) {
  await requirePanel();
  await clientApi.sendCommand(server.uuid, command);
}

// ---------- Files ----------

export const files = {
  async list(server: ServerRow, directory: string) {
    await requirePanel();
    return clientApi.listFiles(server.uuid, directory);
  },
  async read(server: ServerRow, file: string) {
    await requirePanel();
    return clientApi.readFile(server.uuid, file);
  },
  async write(server: ServerRow, file: string, content: string) {
    await requirePanel();
    return clientApi.writeFile(server.uuid, file, content);
  },
  async delete(server: ServerRow, root: string, filesList: string[]) {
    await requirePanel();
    return clientApi.deleteFiles(server.uuid, root, filesList);
  },
  async rename(server: ServerRow, root: string, renames: { from: string; to: string }[]) {
    await requirePanel();
    return clientApi.renameFiles(server.uuid, root, renames);
  },
  async copy(server: ServerRow, location: string, name: string) {
    await requirePanel();
    return clientApi.copyFile(server.uuid, location, name);
  },
  async createDirectory(server: ServerRow, root: string, name: string) {
    await requirePanel();
    return clientApi.createDirectory(server.uuid, root, name);
  },
  async compress(server: ServerRow, root: string, list: string[]) {
    await requirePanel();
    return clientApi.compress(server.uuid, root, list);
  },
  async decompress(server: ServerRow, root: string, file: string) {
    await requirePanel();
    return clientApi.decompress(server.uuid, root, file);
  },
  async upload(server: ServerRow, directory: string, buffer: Buffer, name: string) {
    await requirePanel();
    const url = await clientApi.getUploadUrl(server.uuid, directory);
    await fetch(url, { method: "POST", body: new Blob([buffer]) });
  },
  async download(res: Response, server: ServerRow, file: string) {
    await requirePanel();
    const url = await clientApi.getDownloadUrl(server.uuid, file);
    res.redirect(url);
  },
};

// ---------- Backups ----------

export const backups = {
  async list(server: ServerRow) {
    await requirePanel();
    return clientApi.getBackups(server.uuid);
  },
  async create(server: ServerRow, name?: string) {
    await requirePanel();
    return clientApi.createBackup(server.uuid, name);
  },
  async restore(server: ServerRow, backupId: string) {
    await requirePanel();
    return clientApi.restoreBackup(server.uuid, backupId);
  },
  async delete(server: ServerRow, backupId: string) {
    await requirePanel();
    return clientApi.deleteBackup(server.uuid, backupId);
  },
  async download(res: Response, server: ServerRow, backupId: string) {
    await requirePanel();
    const url = await clientApi.getBackupDownloadUrl(server.uuid, backupId);
    res.redirect(url);
  },
};

// ---------- Databases ----------

export const databases = {
  async list(server: ServerRow) {
    await requirePanel();
    return clientApi.getDatabases(server.uuid);
  },
  async create(server: ServerRow, database: string, remote: string) {
    await requirePanel();
    return clientApi.createDatabase(server.uuid, { database, remote });
  },
  async resetPassword(server: ServerRow, dbId: string) {
    await requirePanel();
    return clientApi.rotateDatabasePassword(server.uuid, dbId);
  },
  async delete(server: ServerRow, dbId: string) {
    await requirePanel();
    return clientApi.deleteDatabase(server.uuid, dbId);
  },
};

// ---------- Network ----------

export const network = {
  async allocations(server: ServerRow) {
    await requirePanel();
    return clientApi.getNetwork(server.uuid);
  },
  async create(server: ServerRow) {
    await requirePanel();
    const node = server.nodeId;
    if (!node) throw ApiError.badRequest("Server node unknown");
    const free = (await appApi.getNodeAllocations(node, "per_page=100")).find((a: any) => !a.assigned);
    if (!free) throw ApiError.badRequest("No free allocations on node");
    return appApi.addAllocation(server.externalId!, { ip: free.ip, port: free.port });
  },
  async setPrimary(server: ServerRow, allocationId: string) {
    await requirePanel();
    return clientApi.setPrimary(server.uuid, allocationId);
  },
  async delete(server: ServerRow, allocationId: string) {
    await requirePanel();
    return clientApi.deleteAllocation(server.uuid, allocationId);
  },
};

// ---------- SFTP / Startup ----------

export async function getSftp(server: ServerRow) {
  await requirePanel();
  const panel = await clientApi.getServer(server.uuid).catch(() => null);
  const sftp = panel?.sftp_details;
  if (sftp) return sftp;
  return clientApi.getSftp(server.uuid);
}

export async function getStartup(server: ServerRow) {
  await requirePanel();
  return clientApi.getStartup(server.uuid);
}

export async function updateStartup(server: ServerRow, body: { startup?: string; environment?: Record<string, string> }) {
  await requirePanel();
  return clientApi.updateStartup(server.uuid, body);
}

export async function suspendServer(server: ServerRow) {
  await requirePanel();
  if (server.externalId) {
    await appApi.suspendServer(server.externalId);
  }
  await prisma.server.update({ where: { id: server.id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
}

export async function unsuspendServer(server: ServerRow) {
  await requirePanel();
  if (server.externalId) {
    await appApi.unsuspendServer(server.externalId);
  }
  await prisma.server.update({ where: { id: server.id }, data: { status: "OFFLINE", suspendedAt: null } });
}

export async function deleteServer(server: ServerRow) {
  if (server.externalId) {
    try {
      await appApi.deleteServer(server.externalId);
    } catch {
      // If the panel is unreachable, still delete locally
    }
  }
  await prisma.server.update({ where: { id: server.id }, data: { status: "DELETED" } });
}

export function safeJson(raw: string | null | undefined, fallback: unknown = {}): any {
  try {
    return JSON.parse(raw || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export { parseLimits };