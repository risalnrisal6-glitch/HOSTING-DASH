import { prisma } from "../db";
import { settings } from "./settings";
import { ApiError } from "../lib/errors";
import * as ptero from "../lib/pterodactyl";
import { notifyUser } from "./notify.service";

export interface CreateInput {
  name: string;
  description?: string;
  nestId?: string;
  eggId?: string;
  dockerImage?: string;
  locationId?: string;
  nodeId?: string;
  limits: { ram?: number; swap?: number; disk?: number; io?: number; cpu?: number };
  featureLimits: { databases?: number; allocations?: number; backups?: number };
  startup?: string;
  environment?: Record<string, string>;
  planId?: string;
  cycle?: string;
  price?: number;
}

export async function getUserServerSlots(userId: string): Promise<{ used: number; max: number }> {
  const [used, bought] = await Promise.all([
    prisma.server.count({ where: { userId, status: { not: "DELETED" } } }),
    prisma.transaction.aggregate({ where: { userId, refType: "purchase", refId: "slots" }, _sum: { amount: true } }),
  ]);
  const base = Number(await settings.get("max_servers_per_user")) || 10;
  return { used, max: base + (bought._sum.amount ?? 0) };
}

async function resolveEggName(nestId: string | undefined, eggId: string | undefined): Promise<string | null> {
  if (!nestId || !eggId) return null;
  try {
    const egg = await ptero.getEgg(nestId, eggId);
    return egg?.name ?? null;
  } catch {
    return null;
  }
}

export async function createServerForUser(userId: string, input: CreateInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  const slots = await getUserServerSlots(userId);
  if (slots.used >= slots.max) throw ApiError.badRequest(`Server slot limit reached (${slots.max}). Buy more slots in the shop.`);

  // Normalize resource limits (zod defaults may be undefined at runtime from other callers)
  const limits = {
    ram: input.limits.ram ?? 1024,
    swap: input.limits.swap ?? 0,
    disk: input.limits.disk ?? 10240,
    io: input.limits.io ?? 500,
    cpu: input.limits.cpu ?? 100,
  };
  const featureLimits = {
    databases: input.featureLimits.databases ?? 1,
    allocations: input.featureLimits.allocations ?? 1,
    backups: input.featureLimits.backups ?? 1,
  };

  // Defaults from admin settings
  const s = await settings.getAll();
  const nestId = input.nestId || String(s.default_nest || "");
  const eggId = input.eggId || String(s.default_egg || "");
  const locationId = input.locationId || String(s.default_location || "");
  const dockerImage = input.dockerImage || String(s.default_docker_image || "");
  if (!nestId || !eggId || !locationId) {
    throw ApiError.badRequest("Nest, egg and location are required. Configure defaults in Admin → API Settings or choose them below.");
  }

  const eggName = await resolveEggName(nestId, eggId);
  const created = await ptero.createServer(
    { email: user.email, username: user.username },
    {
      name: input.name,
      nodeId: input.nodeId || String(s.default_node || ""),
      locationId,
      nestId,
      eggId,
      dockerImage,
      limits,
      featureLimits,
      startup: input.startup,
      environment: input.environment ?? {},
    }
  );

  const server = await prisma.server.create({
    data: {
      userId,
      externalId: created.externalId,
      uuid: created.uuid,
      name: input.name,
      description: input.description,
      status: "OFFLINE",
      planId: input.planId,
      billingCycle: input.cycle,
      price: input.price ?? 0,
      renewsAt: input.cycle && input.cycle !== "lifetime" && input.cycle !== "one_time" ? new Date(Date.now() + cycleMs(input.cycle!)) : null,
      locationId,
      nodeId: input.nodeId || String(s.default_node || ""),
      nestId,
      eggId,
      eggName,
      dockerImage,
      startup: input.startup,
      environment: JSON.stringify(input.environment ?? {}),
      limits: JSON.stringify(limits),
      featureLimits: JSON.stringify(featureLimits),
    },
  });

  await notifyUser(userId, {
    type: "server_created",
    title: "Server deployed 🎉",
    body: `${server.name} has been created and is ready to configure.`,
    data: { serverId: server.id, serverUuid: server.uuid },
  });
  return server;
}

function cycleMs(cycle: string): number {
  if (cycle === "monthly") return 30 * 86400000;
  if (cycle === "yearly") return 365 * 86400000;
  return 0;
}

export async function listUserServers(userId: string, search = "") {
  return prisma.server.findMany({
    where: {
      userId,
      status: { not: "DELETED" },
      ...(search ? { name: { contains: search } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserServer(userId: string, idOrUuid: string, staff = false) {
  const server = await prisma.server.findFirst({
    where: { OR: [{ id: idOrUuid }, { uuid: idOrUuid }] },
    include: { plan: true },
  });
  if (!server || server.status === "DELETED") throw ApiError.notFound("Server not found");
  if (server.userId !== userId && !staff) throw ApiError.forbidden();
  return server;
}

export async function renameServer(serverId: string, name: string) {
  return prisma.server.update({ where: { id: serverId }, data: { name } });
}

export async function deleteServerForUser(user: { id: string }, idOrUuid: string, staff = false) {
  const server = await getUserServer(user.id, idOrUuid, staff);
  await ptero.deleteServer(server);
  return server;
}

/** Builds the stats payload (current usage + moving history) for a server. */
export async function serverStats(server: { uuid: string; eggName?: string | null; limits: string; status: string; lastStartAt?: Date | null }) {
  const limits = ptero.safeJson(server.limits);
  const usage = await ptero.getResources(server as never);
  return {
    state: usage.state,
    cpu: usage.cpu,
    memory_bytes: usage.memory_bytes,
    disk_bytes: usage.disk_bytes,
    network_rx_bytes: usage.network_rx_bytes,
    network_tx_bytes: usage.network_tx_bytes,
    uptime_seconds: usage.uptime_seconds,
    limits,
  };
}
