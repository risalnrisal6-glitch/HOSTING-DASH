import { Router } from "express";
import { asyncH } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody } from "../lib/validate";
import { prisma } from "../db";
import * as walletSvc from "../services/wallet.service";
import { audit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

const uid = (req: any) => (req as AuthedRequest).user.id;

// ---- Check-ins ----
router.post(
  "/checkin/:kind",
  asyncH(async (req, res) => {
    const kind = req.params.kind as "daily" | "weekly" | "monthly";
    if (!["daily", "weekly", "monthly"].includes(kind)) throw new (await import("../lib/errors")).ApiError(400, "BAD_REQUEST", "Invalid kind");
    const result = kind === "daily" ? await walletSvc.dailyCheckin(uid(req)) : kind === "weekly" ? await walletSvc.weeklyCheckin(uid(req)) : await walletSvc.monthlyCheckin(uid(req));
    await audit(req, `wallet.checkin.${kind}`, "user", uid(req), { result });
    res.json({ ok: true, data: result });
  })
);

router.get(
  "/checkin",
  asyncH(async (req, res) => {
    res.json({ ok: true, data: await walletSvc.getCheckinStatus(uid(req)) });
  })
);

// ---- Ads ----
router.post(
  "/ad",
  asyncH(async (req, res) => {
    const result = await walletSvc.watchAd(uid(req));
    await audit(req, "wallet.ad", "user", uid(req), { result });
    res.json({ ok: true, data: result });
  })
);

// ---- Tasks ----
router.get(
  "/tasks",
  asyncH(async (req, res) => {
    const tasks = await prisma.task.findMany({ where: { enabled: true }, orderBy: { sort: "asc" } });
    const completed = await prisma.taskCompletion.findMany({ where: { userId: uid(req) } });
    const done = new Set(completed.map((c) => c.taskId));
    res.json({ ok: true, data: tasks.map((t) => ({ ...t, completed: done.has(t.id) })) });
  })
);

router.post(
  "/tasks/:id/claim",
  asyncH(async (req, res) => {
    const result = await walletSvc.claimTask(uid(req), req.params.id);
    await audit(req, "wallet.task", "user", uid(req), { taskId: req.params.id });
    res.json({ ok: true, data: result });
  })
);

// ---- Voting ----
router.get(
  "/vote",
  asyncH(async (req, res) => {
    res.json({ ok: true, data: await walletSvc.claimVote(uid(req)) });
  })
);

// ---- Lucky spin ----
router.get(
  "/spin/config",
  asyncH(async (req, res) => {
    const cfg = await walletSvc.getWheelConfig();
    const spins = await prisma.spinEntry.count({ where: { userId: uid(req) } });
    res.json({ ok: true, data: { config: cfg, totalSpins: spins } });
  })
);

router.post(
  "/spin",
  asyncH(async (req, res) => {
    const result = await walletSvc.spin(uid(req));
    await audit(req, "wallet.spin", "user", uid(req), { result });
    res.json({ ok: true, data: result });
  })
);

// ---- Promo codes ----
router.post(
  "/promo",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ code: z.string().min(3).max(32) }), req);
    const result = await walletSvc.redeemPromo(uid(req), data.code);
    await audit(req, "wallet.promo", "user", uid(req), { code: data.code });
    res.json({ ok: true, data: result });
  })
);

// ---- Giveaways ----
router.get(
  "/giveaways",
  asyncH(async (req, res) => {
    const giveaways = await prisma.giveaway.findMany({ orderBy: { endsAt: "desc" }, take: 20 });
    const myEntries = await prisma.giveawayEntry.findMany({ where: { userId: uid(req) } });
    const entered = new Set(myEntries.map((e) => e.giveawayId));
    const winners = await prisma.user.findMany({ where: { id: { in: giveaways.map((g) => g.winnerId).filter(Boolean) as string[] } }, select: { id: true, username: true } });
    const winnerMap = new Map(winners.map((w) => [w.id, w.username]));
    const entryCounts = await Promise.all(giveaways.map((g) => (g.status === "ended" ? Promise.resolve(null) : prisma.giveawayEntry.count({ where: { giveawayId: g.id } }))));
    res.json({
      ok: true,
      data: giveaways.map((g, i) => ({
        ...g,
        entered: entered.has(g.id),
        entryCount: entryCounts[i],
        winner: g.winnerId ? winnerMap.get(g.winnerId) : null,
      })),
    });
  })
);

router.post(
  "/giveaways/:id/enter",
  asyncH(async (req, res) => {
    await walletSvc.enterGiveaway(uid(req), req.params.id);
    res.json({ ok: true });
  })
);

// ---- Referral (mine) ----
router.get(
  "/referral",
  asyncH(async (req, res) => {
    const { getReferralStats } = await import("../services/referral.service");
    res.json({ ok: true, data: await getReferralStats(uid(req)) });
  })
);

router.get(
  "/leaderboard",
  asyncH(async (req, res) => {
    const { getLeaderboard } = await import("../services/referral.service");
    res.json({ ok: true, data: await getLeaderboard(Number(req.query.limit || 20)) });
  })
);

export default router;
