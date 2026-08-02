import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import { wallet, adminRewardCoins, adminRewardBalance, getWheelConfig } from "./wallet.service";
import { broadcast, notifyUser } from "./notify.service";
import * as ptero from "../lib/pterodactyl";
import { settings } from "./settings";

// ============================================================
// Admin panel service layer
// ============================================================

export async function dashboardStats() {
  const [users, servers, coinsSum, balanceSum, pendingInvoices, openTickets, todayUsers] = await Promise.all([
    prisma.user.count(),
    prisma.server.count({ where: { status: { not: "DELETED" } } }),
    prisma.user.aggregate({ _sum: { coins: true } }),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.invoice.count({ where: { status: "pending" } }),
    prisma.ticket.count({ where: { status: { not: "closed" } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  const recent = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, username: true, avatar: true, email: true, coins: true, createdAt: true } });
  const recentServers = await prisma.server.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { username: true } } } });
  const revenue = await prisma.invoice.aggregate({ where: { status: "paid" }, _sum: { amount: true } });
  return {
    users, servers, coinsInCirculation: coinsSum._sum.coins ?? 0, walletTotal: balanceSum._sum.balance ?? 0,
    pendingInvoices, openTickets, newUsersToday: todayUsers, revenue: revenue._sum.amount ?? 0,
    recent, recentServers,
  };
}

// ---------- Users ----------

export async function listUsers(page: number, limit: number, search: string) {
  const where = search
    ? { OR: [{ username: { contains: search } }, { email: { contains: search } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { _count: { select: { servers: true } } } }),
    prisma.user.count({ where }),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

export async function getUserAdmin(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { servers: { where: { status: { not: "DELETED" } } }, _count: { select: { transactions: true, tickets: true, referrals: true } } },
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function updateUserRole(id: string, role: string, status?: string) {
  const valid = ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"];
  if (!valid.includes(role)) throw ApiError.badRequest("Invalid role");
  const user = await prisma.user.update({ where: { id }, data: { role: role as never, ...(status ? { status } : {}) } });
  await notifyUser(id, { type: "system", title: "Account updated", body: "Your account details were updated by an administrator." });
  return user;
}

export async function banUser(id: string, ban: boolean) {
  const user = await prisma.user.update({ where: { id }, data: { status: ban ? "banned" : "active" } });
  if (ban) {
    // Suspend all their servers
    await prisma.server.updateMany({ where: { userId: id, status: { not: "DELETED" } }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    await notifyUser(id, { type: "system", title: "Account suspended", body: "Your account has been suspended by an administrator." });
  }
  return user;
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

// ---------- Servers ----------

export async function listServersAdmin(page: number, limit: number, search: string) {
  const where = search
    ? { OR: [{ name: { contains: search } }, { user: { is: { username: { contains: search } } } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.server.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { user: { select: { id: true, username: true, email: true } } } }),
    prisma.server.count({ where }),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

export async function adminSuspendServer(serverId: string, suspend: boolean) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw ApiError.notFound("Server not found");
  if (suspend) await ptero.suspendServer(server);
  else await ptero.unsuspendServer(server);
  await notifyUser(server.userId, {
    type: "server_suspended",
    title: suspend ? "Server suspended" : "Server re-enabled",
    body: `${server.name} was ${suspend ? "suspended" : "re-enabled"} by an administrator.`,
    data: { serverId: server.id },
  });
  return prisma.server.findUnique({ where: { id: serverId } });
}

// ---------- Plans ----------

export async function upsertPlan(data: any, id?: string) {
  const payload = {
    name: data.name,
    slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: data.description,
    price: data.price,
    cycle: data.cycle,
    ram: data.ram, swap: data.swap, cpu: data.cpu, disk: data.disk,
    databases: data.databases, backups: data.backups, allocations: data.allocations,
    nestId: data.nestId || null, eggId: data.eggId || null, eggName: data.eggName || null,
    dockerImage: data.dockerImage || null, locationId: data.locationId || null,
    startup: data.startup || null,
    environment: JSON.stringify(data.environment ?? {}),
    active: data.active !== false,
    sort: data.sort ?? 0,
  };
  if (id) return prisma.plan.update({ where: { id }, data: payload });
  return prisma.plan.create({ data: payload });
}

export async function deletePlan(id: string) {
  const servers = await prisma.server.count({ where: { planId: id } });
  if (servers > 0) throw ApiError.badRequest("Cannot delete a plan that has servers attached");
  return prisma.plan.delete({ where: { id } });
}

// ---------- Shop items ----------

export async function upsertShopItem(data: any) {
  return prisma.shopItem.upsert({
    where: { type: data.type },
    create: data,
    update: data,
  });
}

// ---------- Coupons / promo codes ----------

export async function upsertPromo(data: any, id?: string) {
  const payload = {
    code: (data.code || "").toUpperCase(),
    type: data.type,
    value: data.value,
    minAmount: data.minAmount ?? 0,
    maxUses: data.maxUses ?? 0,
    perUserLimit: data.perUserLimit ?? 0,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    enabled: data.enabled !== false,
    description: data.description,
  };
  if (id) return prisma.promoCode.update({ where: { id }, data: payload });
  return prisma.promoCode.create({ data: payload });
}

// ---------- Rewards ----------

export async function saveRewardSetting(key: string, config: unknown) {
  await settings.set(key, config);
  return settings.get(key);
}

export async function saveWheelConfig(config: unknown) {
  await settings.set("spin_wheel", config);
  return getWheelConfig();
}

// ---------- Tasks ----------

export async function upsertTask(data: any, id?: string) {
  const payload = {
    title: data.title, description: data.description, type: data.type,
    url: data.url || null, reward: data.reward, cooldownHours: data.cooldownHours ?? 24,
    enabled: data.enabled !== false, sort: data.sort ?? 0,
  };
  if (id) return prisma.task.update({ where: { id }, data: payload });
  return prisma.task.create({ data: payload });
}

// ---------- Giveaways ----------

export async function upsertGiveaway(data: any, id?: string) {
  const payload = {
    title: data.title, description: data.description, prize: data.prize, coins: data.coins,
    startsAt: new Date(data.startsAt), endsAt: new Date(data.endsAt), status: data.status ?? "upcoming",
  };
  const g = id ? await prisma.giveaway.update({ where: { id }, data: payload }) : await prisma.giveaway.create({ data: payload });
  return g;
}

export async function drawGiveaway(id: string) {
  const g = await prisma.giveaway.findUnique({ where: { id }, include: { entries: { include: { user: true } } } });
  if (!g) throw ApiError.notFound("Giveaway not found");
  if (g.status === "ended" && g.winnerId) throw ApiError.badRequest("Giveaway already drawn");
  if (g.entries.length === 0) throw ApiError.badRequest("No entries yet");
  const winner = g.entries[Math.floor(Math.random() * g.entries.length)];
  await wallet.creditCoins(winner.userId, g.coins, `Won giveaway: ${g.title}`, "giveaway", g.id);
  const updated = await prisma.giveaway.update({ where: { id }, data: { status: "ended", winnerId: winner.userId } });
  await notifyUser(winner.userId, {
    type: "reward",
    title: "You won a giveaway! 🏆",
    body: `Congratulations! You won "${g.title}" — ${g.coins} AKF coins added.`,
    data: { giveawayId: g.id },
  });
  return { ...updated, winner: winner.user.username };
}

// ---------- Announcements ----------

export async function createAnnouncement(data: { title: string; body: string; type: string; active?: boolean; notify?: boolean }) {
  const a = await prisma.announcement.create({
    data: { title: data.title, body: data.body, type: data.type, active: data.active !== false },
  });
  if (data.notify) {
    await broadcast({ type: "announcement", title: data.title, body: data.body });
  }
  return a;
}

export async function deleteAnnouncement(id: string) {
  return prisma.announcement.delete({ where: { id } });
}

// ---------- Roles ----------

export async function upsertRole(data: any, id?: string) {
  const payload = { name: data.name, description: data.description, permissions: JSON.stringify(data.permissions ?? []) };
  if (id) return prisma.role.update({ where: { id }, data: payload });
  return prisma.role.create({ data: payload });
}

export async function deleteRole(id: string) {
  const users = await prisma.user.count({ where: { roleId: id } });
  if (users > 0) throw ApiError.badRequest("Role is assigned to users");
  return prisma.role.delete({ where: { id } });
}

// ---------- Logs ----------

export async function listLogs(page: number, limit: number, search: string) {
  const where = search ? { OR: [{ username: { contains: search } }, { action: { contains: search } }] } : {};
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

// ---------- Payments admin ----------

export async function listPayments(page: number, limit: number, status: string) {
  const where = status && status !== "all" ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { user: { select: { username: true, email: true } } } }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

export async function approvePayment(invoiceId: string, adminId: string) {
  const { markPaid } = await import("./billing.service");
  return markPaid(invoiceId, "manual", { byUserId: adminId });
}

export async function refusePayment(invoiceId: string, note: string) {
  return prisma.invoice.update({ where: { id: invoiceId }, data: { status: "cancelled", meta: JSON.stringify({ refuseNote: note }) } });
}

export async function listRefunds(page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.refundRequest.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { invoice: { include: { user: { select: { username: true } } } } } }),
    prisma.refundRequest.count(),
  ]);
  return { items, total, pages: Math.ceil(total / limit), page };
}

export async function resolveRefund(refundId: string, approve: boolean, note: string) {
  const refund = await prisma.refundRequest.findUnique({ where: { id: refundId }, include: { invoice: true } });
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (approve) {
    await wallet.creditBalance(refund.invoice.userId, refund.invoice.amount, `Refund for ${refund.invoice.number}`, "refund", refund.invoice.id);
    await prisma.invoice.update({ where: { id: refund.invoice.id }, data: { status: "refunded" } });
    await notifyUser(refund.userId, { type: "payment_received", title: "Refund processed", body: `Your refund of $${refund.invoice.amount.toFixed(2)} was approved.` });
  } else {
    await notifyUser(refund.userId, { type: "payment_received", title: "Refund declined", body: `Your refund request was declined${note ? `: ${note}` : "."}` });
  }
  return prisma.refundRequest.update({ where: { id: refundId }, data: { status: approve ? "approved" : "rejected", adminNote: note, resolvedAt: new Date() } });
}

// ---------- Misc admin ----------

export async function adminGrantCoins(userId: string, amount: number, reason: string) {
  await adminRewardCoins(userId, amount, reason);
}

export async function adminGrantBalance(userId: string, amount: number, reason: string) {
  await adminRewardBalance(userId, amount, reason);
}

export async function panelSync() {
  return ptero.syncPanelData();
}
