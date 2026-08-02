import { prisma } from "../db";
import { settings } from "./settings";
import { ApiError } from "../lib/errors";
import { randomInt } from "../lib/crypto";
import { notifyUser } from "./notify.service";

// ============================================================
// Wallet & AKF coin economy.
// currency: "AKF" = coins (integer), "balance" = wallet money (float)
// ============================================================

export interface LedgerEntry {
  kind: "credit" | "debit";
  currency: "AKF" | "balance";
  amount: number;
  description: string;
  refType?: string;
  refId?: string;
  meta?: Record<string, unknown>;
  serverId?: string;
}

async function applyLedger(userId: string, entry: LedgerEntry): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound("User not found");
    const delta = entry.kind === "credit" ? entry.amount : -entry.amount;
    if (entry.currency === "AKF") {
      const next = user.coins + Math.round(delta);
      if (next < 0) throw ApiError.badRequest("Insufficient AKF coins");
      await tx.user.update({ where: { id: userId }, data: { coins: next } });
    } else {
      const next = user.balance + delta;
      if (next < -0.0001) throw ApiError.badRequest("Insufficient wallet balance");
      await tx.user.update({ where: { id: userId }, data: { balance: Math.max(0, next) } });
    }
    await tx.transaction.create({
      data: {
        userId,
        kind: entry.kind,
        currency: entry.currency,
        amount: entry.amount,
        description: entry.description,
        refType: entry.refType,
        refId: entry.refId,
        meta: JSON.stringify(entry.meta ?? {}),
        serverId: entry.serverId,
      },
    });
  });
}

export const wallet = {
  creditCoins: (userId: string, amount: number, description: string, refType?: string, refId?: string, meta?: Record<string, unknown>) =>
    applyLedger(userId, { kind: "credit", currency: "AKF", amount, description, refType, refId, meta }),
  debitCoins: (userId: string, amount: number, description: string, refType?: string, refId?: string, meta?: Record<string, unknown>) =>
    applyLedger(userId, { kind: "debit", currency: "AKF", amount, description, refType, refId, meta }),
  creditBalance: (userId: string, amount: number, description: string, refType?: string, refId?: string, meta?: Record<string, unknown>) =>
    applyLedger(userId, { kind: "credit", currency: "balance", amount, description, refType, refId, meta }),
  debitBalance: (userId: string, amount: number, description: string, refType?: string, refId?: string, meta?: Record<string, unknown>) =>
    applyLedger(userId, { kind: "debit", currency: "balance", amount, description, refType, refId, meta }),

  async getTransactions(userId: string, page = 1, limit = 15) {
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.transaction.count({ where: { userId } }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  },
};

// ---------- Daily / weekly / monthly check-ins ----------

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Claim period key per check-in kind:
 * - daily   → YYYY-MM-DD
 * - weekly  → date of the current week's Monday
 * - monthly → YYYY-MM
 * Using the right period is what makes weekly/monthly rewards actually
 * claimable once per week/month instead of every single day.
 */
function periodKey(kind: "daily" | "weekly" | "monthly"): string {
  const now = new Date();
  if (kind === "daily") return todayKey();
  if (kind === "weekly") {
    const day = now.getUTCDay(); // 0=Sun … 6=Sat
    const diff = day === 0 ? 6 : day - 1; // days since Monday
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
    return monday.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 7); // YYYY-MM
}

async function checkin(userId: string, kind: "daily" | "weekly" | "monthly", cfgKey: string): Promise<{ reward: number; streak: number; alreadyClaimed: boolean }> {
  const cfg = (await settings.get(cfgKey)) as { amount: number; enabled: boolean } | undefined;
  if (!cfg?.enabled) throw ApiError.badRequest("This reward is currently disabled");
  const date = periodKey(kind);
  const existing = await prisma.checkin.findUnique({ where: { userId_kind_date: { userId, kind, date } } });
  if (existing) return { reward: 0, streak: existing.streak, alreadyClaimed: true };

  let streak = 1;
  if (kind === "daily") {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prev = await prisma.checkin.findUnique({ where: { userId_kind_date: { userId, kind, date: yesterday } } });
    streak = (prev?.streak ?? 0) + 1;
  }

  const base = cfg.amount ?? 0;
  const bonus = kind === "daily" && streak >= 7 ? Math.round(base * 0.5) : 0; // weekly streak bonus
  const reward = base + bonus;
  await prisma.checkin.create({ data: { userId, kind, date, reward, streak } });
  await wallet.creditCoins(userId, reward, `${kind === "daily" ? "Daily" : kind === "weekly" ? "Weekly" : "Monthly"} check-in reward${bonus ? ` (+${bonus} streak bonus)` : ""}`, "checkin", kind, { streak });
  return { reward, streak, alreadyClaimed: false };
}

export async function dailyCheckin(userId: string) {
  return checkin(userId, "daily", "daily_checkin");
}

export async function weeklyCheckin(userId: string) {
  return checkin(userId, "weekly", "weekly_checkin");
}

export async function monthlyCheckin(userId: string) {
  return checkin(userId, "monthly", "monthly_checkin");
}

export async function getCheckinStatus(userId: string) {
  const [daily, weekly, monthly, dailyStreak] = await Promise.all([
    prisma.checkin.findUnique({ where: { userId_kind_date: { userId, kind: "daily", date: periodKey("daily") } } }),
    prisma.checkin.findUnique({ where: { userId_kind_date: { userId, kind: "weekly", date: periodKey("weekly") } } }),
    prisma.checkin.findUnique({ where: { userId_kind_date: { userId, kind: "monthly", date: periodKey("monthly") } } }),
    prisma.checkin.findMany({ where: { userId, kind: "daily" }, orderBy: { date: "desc" }, take: 30 }),
  ]);
  return {
    dailyClaimed: !!daily,
    weeklyClaimed: !!weekly,
    monthlyClaimed: !!monthly,
    streak: dailyStreak[0]?.streak ?? 0,
    last7: dailyStreak.slice(0, 7).map((c) => c.date),
  };
}

// ---------- Ads ----------

export async function watchAd(userId: string): Promise<{ reward: number }> {
  const cfg = (await settings.get("ad_watch")) as { amount: number; cooldownMinutes: number; dailyLimit: number; enabled: boolean } | undefined;
  if (!cfg?.enabled) throw ApiError.badRequest("Watching ads is currently disabled");
  const since = new Date(Date.now() - (cfg.cooldownMinutes ?? 3) * 60000);
  const recent = await prisma.transaction.findFirst({ where: { userId, refType: "ad", createdAt: { gte: since } } });
  const cooldownMin = cfg.cooldownMinutes ?? 3;
  if (recent) throw ApiError.badRequest(`Ad reward on cooldown — try again in ${cooldownMin} minute${cooldownMin > 1 ? "s" : ""}`);

  const today = todayKey();
  const todayCount = await prisma.transaction.count({ where: { userId, refType: "ad", createdAt: { gte: new Date(today + "T00:00:00Z") } } });
  if (todayCount >= (cfg.dailyLimit ?? 10)) throw ApiError.badRequest("Daily ad reward limit reached");

  const reward = cfg.amount ?? 5;
  await wallet.creditCoins(userId, reward, "Watched an ad reward", "ad");
  return { reward };
}

// ---------- AFK earning (idle time in panel) ----------

/**
 * Grants coins while the user keeps the panel open. Admin configurable:
 * afk_enabled, afk_coins_per_min, afk_interval_minutes, afk_daily_limit.
 * Enforced server-side: one grant per interval + a daily cap, so the
 * heartbeat client can never out-earn the configured rates.
 */
export async function afkEarn(userId: string): Promise<{ reward: number; nextIn: number }> {
  if ((await settings.get("afk_enabled")) !== true) throw ApiError.badRequest("AFK rewards are disabled");
  const perMin = Number((await settings.get("afk_coins_per_min")) ?? 30) || 0;
  const intervalMin = Number((await settings.get("afk_interval_minutes")) ?? 1) || 1;
  const dailyLimit = Number((await settings.get("afk_daily_limit")) ?? 500) || 0;
  if (perMin <= 0) throw ApiError.badRequest("AFK reward amount is not configured");

  // Cooldown: at most one grant per interval
  const since = new Date(Date.now() - intervalMin * 60000);
  const recent = await prisma.transaction.findFirst({ where: { userId, refType: "afk", createdAt: { gte: since } } });
  if (recent) {
    const nextIn = Math.max(1, Math.ceil((recent.createdAt.getTime() + intervalMin * 60000 - Date.now()) / 1000));
    return { reward: 0, nextIn };
  }

  // Daily cap
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = await prisma.transaction.count({ where: { userId, refType: "afk", createdAt: { gte: new Date(today + "T00:00:00Z") } } });
  if (dailyLimit > 0 && todayCount >= dailyLimit) throw ApiError.badRequest("Daily AFK reward limit reached");

  await wallet.creditCoins(userId, perMin, `AFK reward — ${intervalMin} minute${intervalMin > 1 ? "s" : ""} active in panel`, "afk");
  return { reward: perMin, nextIn: intervalMin * 60 };
}

// ---------- Tasks ----------

export async function claimTask(userId: string, taskId: string): Promise<{ reward: number }> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.enabled) throw ApiError.notFound("Task not found");
  const existing = await prisma.taskCompletion.findUnique({ where: { taskId_userId: { taskId, userId } } });
  if (existing) throw ApiError.badRequest("Task already completed");
  await prisma.taskCompletion.create({ data: { taskId, userId, reward: task.reward } });
  await wallet.creditCoins(userId, task.reward, `Completed task: ${task.title}`, "task", task.id);
  return { reward: task.reward };
}

// ---------- Voting ----------

export async function claimVote(userId: string): Promise<{ reward: number; url: string }> {
  const cfg = (await settings.get("vote")) as { amount: number; cooldownHours: number; url: string; enabled: boolean } | undefined;
  if (!cfg?.enabled) throw ApiError.badRequest("Voting rewards are disabled");
  const since = new Date(Date.now() - (cfg.cooldownHours ?? 12) * 3600000);
  const recent = await prisma.transaction.findFirst({ where: { userId, refType: "vote", createdAt: { gte: since } } });
  if (recent) throw ApiError.badRequest("You can claim a vote reward again later");
  const reward = cfg.amount ?? 15;
  await wallet.creditCoins(userId, reward, "Voting reward", "vote");
  return { reward, url: cfg.url || "" };
}

// ---------- Lucky spin wheel ----------

interface WheelConfig {
  enabled: boolean;
  cost: number;
  dailyLimit: number;
  segments: { label: string; coins: number; weight: number; color: string }[];
}

export async function getWheelConfig(): Promise<WheelConfig> {
  const cfg = (await settings.get("spin_wheel")) as Partial<WheelConfig> | undefined;
  const defaults: WheelConfig = {
    enabled: true,
    cost: 0,
    dailyLimit: 5,
    segments: [
      { label: "+5", coins: 5, weight: 30, color: "#818cf8" },
      { label: "+10", coins: 10, weight: 25, color: "#a78bfa" },
      { label: "+25", coins: 25, weight: 18, color: "#60a5fa" },
      { label: "+50", coins: 50, weight: 12, color: "#c084fc" },
      { label: "+100", coins: 100, weight: 8, color: "#f472b6" },
      { label: "+250", coins: 250, weight: 4, color: "#fbbf24" },
      { label: "+500", coins: 500, weight: 2, color: "#34d399" },
      { label: "+1000", coins: 1000, weight: 1, color: "#f87171" },
    ],
  };
  return { ...defaults, ...(cfg ?? {}) };
}

export async function spin(userId: string): Promise<{ result: string; coins: number; segmentIndex: number }> {
  const cfg = await getWheelConfig();
  if (!cfg.enabled) throw ApiError.badRequest("Lucky spin is disabled");

  const today = todayKey();
  const todaySpins = await prisma.spinEntry.count({ where: { userId, createdAt: { gte: new Date(today + "T00:00:00Z") } } });
  if (todaySpins >= (cfg.dailyLimit ?? 5)) throw ApiError.badRequest("Daily spin limit reached");

  if (cfg.cost > 0) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.coins < cfg.cost) throw ApiError.badRequest("Not enough AKF coins to spin");
    await wallet.debitCoins(userId, cfg.cost, "Lucky spin cost", "spin");
  }

  const total = cfg.segments.reduce((s, x) => s + x.weight, 0);
  const roll = randomInt(total); // crypto-secure, not time-predictable
  let acc = 0;
  let idx = 0;
  for (let i = 0; i < cfg.segments.length; i++) {
    acc += cfg.segments[i].weight;
    if (roll <= acc) {
      idx = i;
      break;
    }
  }
  const segment = cfg.segments[idx];
  await prisma.spinEntry.create({ data: { userId, result: segment.label, coins: segment.coins } });
  if (segment.coins > 0) {
    await wallet.creditCoins(userId, segment.coins, `Lucky spin won: ${segment.label}`, "spin", undefined, { segment: idx });
  }
  return { result: segment.label, coins: segment.coins, segmentIndex: idx };
}

// ---------- Promo codes ----------

export async function redeemPromo(userId: string, code: string): Promise<{ value: number; type: string }> {
  const promo = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo || !promo.enabled) throw ApiError.notFound("Invalid promo code");
  if (promo.expiresAt && promo.expiresAt < new Date()) throw ApiError.badRequest("Promo code has expired");
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) throw ApiError.badRequest("Promo code usage limit reached");

  const usageCount = await prisma.transaction.count({ where: { userId, refType: "promo", refId: promo.id } });
  if (promo.perUserLimit > 0 && usageCount >= promo.perUserLimit) throw ApiError.badRequest("Promo code already redeemed by you");

  await prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
  if (promo.type === "percent") {
    // Percent promo requires a minimum order context — award bonus coins equal to value% of a nominal 100 = value coins
    const value = Math.round(promo.value);
    await wallet.creditCoins(userId, value, `Promo code ${promo.code}: ${promo.value}% bonus`, "promo", promo.id);
    return { value, type: "percent" };
  }
  await wallet.creditCoins(userId, promo.value, `Promo code ${promo.code}`, "promo", promo.id);
  return { value: promo.value, type: "fixed" };
}

// ---------- Giveaways ----------

export async function enterGiveaway(userId: string, giveawayId: string): Promise<void> {
  const g = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!g) throw ApiError.notFound("Giveaway not found");
  if (g.status !== "running") throw ApiError.badRequest("Giveaway is not running");
  if (g.endsAt < new Date()) throw ApiError.badRequest("Giveaway has ended");
  const existing = await prisma.giveawayEntry.findUnique({ where: { giveawayId_userId: { giveawayId, userId } } });
  if (existing) throw ApiError.badRequest("You already entered this giveaway");
  await prisma.giveawayEntry.create({ data: { giveawayId, userId } });
}

// ---------- Admin rewards ----------

export async function adminRewardCoins(userId: string, amount: number, reason: string) {
  await wallet.creditCoins(userId, amount, `Admin reward: ${reason}`, "admin");
  await notifyUser(userId, {
    type: "reward",
    title: "AKF Coins received!",
    body: `You received ${amount} AKF coins — ${reason}`,
  });
}

export async function adminRewardBalance(userId: string, amount: number, reason: string) {
  await wallet.creditBalance(userId, amount, `Admin credit: ${reason}`, "admin");
  await notifyUser(userId, {
    type: "reward",
    title: "Wallet credited",
    body: `Your wallet balance was credited $${amount.toFixed(2)} — ${reason}`,
  });
}
