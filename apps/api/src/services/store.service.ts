import { prisma } from "../db";
import { wallet } from "./wallet.service";
import { ApiError } from "../lib/errors";
import { notifyUser } from "./notify.service";
import { settings } from "./settings";

// ============================================================
// Store: purchasable hosting plans + AKF-coin resource shop.
// ============================================================

export async function listPlans(activeOnly = true) {
  return prisma.plan.findMany({ where: activeOnly ? { active: true } : {}, orderBy: [{ sort: "asc" }, { price: "asc" }] });
}

export async function listShopItems(activeOnly = true) {
  const items = await prisma.shopItem.findMany({ where: activeOnly ? { enabled: true } : {}, orderBy: { sort: "asc" } });
  return items.map((i) => ({ ...i, effectivePrice: Math.round(i.price * (1 - i.discount / 100) * 100) / 100 }));
}

// ---------- Resource shop ----------

const RESOURCE_TYPES = ["ram", "cpu", "disk", "databases", "backups", "allocations", "slots"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * Buys `units` of a resource for a server (or server slots for the account).
 * Applies pricing, discount, stock and per-user limits, then upgrades the
 * server instantly through the Pterodactyl panel (or demo mode).
 */
export async function purchaseResource(userId: string, type: ResourceType, units: number, serverId?: string) {
  const item = await prisma.shopItem.findUnique({ where: { type } });
  if (!item || !item.enabled) throw ApiError.notFound("Shop item not found");
  if (units < item.minUnits) throw ApiError.badRequest(`Minimum purchase is ${item.minUnits} ${item.unit}`);
  if (units > item.maxPerUser) throw ApiError.badRequest(`Maximum purchase is ${item.maxPerUser} ${item.unit}`);

  // Per-user lifetime purchase limit from ledger
  const bought = await prisma.transaction.count({ where: { userId, refType: "purchase", refId: type } });
  if (bought + 1 > item.maxPerUser) throw ApiError.badRequest("You have reached the purchase limit for this resource");

  // Stock check
  if (item.stock >= 0) {
    const sold = await prisma.transaction.count({ where: { refType: "purchase", refId: type } });
    if (sold + 1 > item.stock) throw ApiError.badRequest("Out of stock");
  }

  const price = Math.round(item.price * (1 - item.discount / 100) * 100) / 100;
  const total = price * units;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.coins < total) throw ApiError.badRequest(`You need ${total} AKF coins`);

  if (type === "slots") {
    await wallet.debitCoins(userId, total, `Purchased ${units} server slot${units > 1 ? "s" : ""}`, "purchase", type, { type, units });
    await notifyUser(userId, { type: "resource_upgraded", title: "Server slots added", body: `You now own ${units} additional server slot${units > 1 ? "s" : ""}.` });
    return { item, total, units };
  }

  if (!serverId) throw ApiError.badRequest("Select a server to upgrade");
  const server = await prisma.server.findFirst({ where: { id: serverId, userId } });
  if (!server) throw ApiError.forbidden("Server not found");

  // Apply upgrade
  const limits = safeObj(server.limits);
  const features = safeObj(server.featureLimits);
  const MEGABYTE_STEP = 256;
  if (type === "ram") limits.ram = (limits.ram || 1024) + units * MEGABYTE_STEP;
  else if (type === "cpu") limits.cpu = (limits.cpu || 100) + units * 10;
  else if (type === "disk") limits.disk = (limits.disk || 10240) + units * 1024;
  else if (type === "databases") features.databases = (features.databases || 0) + units;
  else if (type === "backups") features.backups = (features.backups || 0) + units;
  else if (type === "allocations") features.allocations = (features.allocations || 0) + units;

  // Push to the live panel (build update) when connected
  if (await settings.isPanelConfigured() && server.externalId) {
    const { appApi } = await import("../lib/pterodactyl/app-api");
    await appApi.updateBuild(server.externalId, { limits, feature_limits: features });
  }

  await prisma.server.update({ where: { id: server.id }, data: { limits: JSON.stringify(limits), featureLimits: JSON.stringify(features) } });
  await wallet.debitCoins(userId, total, `Upgraded ${item.name} (+${units} ${item.unit}) on ${server.name}`, "purchase", type, { type, units, server: server.name });

  await notifyUser(userId, {
    type: "resource_upgraded",
    title: "Resources upgraded 🚀",
    body: `${server.name} now has +${units} ${item.unit} of ${item.name}.`,
    data: { serverId: server.id, serverUuid: server.uuid },
  });
  return { item, total, units };
}

function safeObj(raw: string): Record<string, number> {
  try {
    return JSON.parse(raw || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

// ---------- Plan purchases (invoice is created here, paid via billing) ----------

export async function createPlanInvoice(userId: string, planId: string, cycle: string, promoCode?: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw ApiError.notFound("Plan not found");

  let price = plan.price;
  const cycles: Record<string, number> = { one_time: 1, monthly: 1, yearly: 12, lifetime: 1 };
  const multiplier = cycles[cycle] ?? 1;
  if (cycle === "yearly") price = Math.round(plan.price * multiplier * 0.85 * 100) / 100; // 15% yearly discount
  else if (cycle === "monthly") price = plan.price;

  let promo: { id: string; code: string } | null = null;
  let discount = 0;
  if (promoCode) {
    const found = await prisma.promoCode.findUnique({ where: { code: promoCode.trim().toUpperCase() } });
    if (!found || !found.enabled) throw ApiError.badRequest("Invalid promo code");
    if (found.expiresAt && found.expiresAt < new Date()) throw ApiError.badRequest("Promo code expired");
    if (found.maxUses > 0 && found.usedCount >= found.maxUses) throw ApiError.badRequest("Promo code usage limit reached");
    const used = await prisma.invoice.count({ where: { promoCodeId: found.id, userId } });
    if (found.perUserLimit > 0 && used >= found.perUserLimit) throw ApiError.badRequest("Promo code already used by you");
    discount = found.type === "percent" ? Math.round(price * (found.value / 100) * 100) / 100 : Math.min(found.value, price);
    promo = { id: found.id, code: found.code };
  }

  const finalPrice = Math.max(0, Math.round((price - discount) * 100) / 100);
  const count = await prisma.invoice.count();
  const invoice = await prisma.invoice.create({
    data: {
      number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
      userId,
      amount: finalPrice,
      description: `${plan.name} — ${cycle} plan`,
      items: JSON.stringify([{ type: "plan", label: `${plan.name} (${cycle})`, amount: finalPrice, planId: plan.id, cycle }]),
      promoCodeId: promo?.id,
      discount,
    },
  });
  if (promo) {
    await prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
  }
  return invoice;
}

/** Called by billing after an invoice is paid — materializes the server. */
export async function materializePlanInvoice(userId: string, invoiceId: string, items: any[]) {
  const planItem = items.find((i) => i.type === "plan");
  if (!planItem) return;
  const plan = await prisma.plan.findUnique({ where: { id: planItem.planId } });
  if (!plan) throw ApiError.badRequest("Plan no longer exists");

  const { createServerForUser } = await import("./server.service");
  const server = await createServerForUser(userId, {
    name: plan.name,
    nestId: plan.nestId || undefined,
    eggId: plan.eggId || undefined,
    dockerImage: plan.dockerImage || undefined,
    locationId: plan.locationId || undefined,
    limits: { ram: plan.ram, swap: plan.swap, disk: plan.disk, io: 500, cpu: plan.cpu },
    featureLimits: { databases: plan.databases, allocations: plan.allocations, backups: plan.backups },
    startup: plan.startup || undefined,
    environment: safeEnv(plan.environment),
    planId: plan.id,
    cycle: planItem.cycle,
    price: plan.price,
  });
  return server;
}

function safeEnv(raw: string): Record<string, string> {
  try {
    return JSON.parse(raw || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
