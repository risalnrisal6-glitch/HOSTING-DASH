import { Router } from "express";
import { asyncH } from "../lib/errors";
import { settings } from "../services/settings";
import { prisma } from "../db";
import { isPanelConnected } from "../lib/pterodactyl";
import { getWheelConfig } from "../services/wallet.service";
import { optionalAuth } from "../lib/rbac";

const router = Router();

router.get(
  "/config",
  asyncH(async (req, res) => {
    const [pub, connected, wheel, announcements] = await Promise.all([
      settings.getPublic(),
      isPanelConnected(),
      getWheelConfig().catch(() => null),
      prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    res.json({ ok: true, data: { settings: pub, panelConnected: connected, wheel, announcements } });
  })
);

router.get(
  "/leaderboard",
  asyncH(async (_req, res) => {
    const { getLeaderboard } = await import("../services/referral.service");
    res.json({ ok: true, data: await getLeaderboard(20) });
  })
);

router.get(
  "/giveaways",
  asyncH(async (req, res) => {
    const giveaways = await prisma.giveaway.findMany({ where: { status: { in: ["upcoming", "running"] } }, orderBy: { endsAt: "asc" }, take: 10 });
    const user = (req as any).user;
    const entered = user ? new Set((await prisma.giveawayEntry.findMany({ where: { userId: user.id } })).map((e) => e.giveawayId)) : new Set();
    const entryCounts = await Promise.all(giveaways.map((g) => prisma.giveawayEntry.count({ where: { giveawayId: g.id } })));
    res.json({
      ok: true,
      data: giveaways.map((g, i) => ({
        ...g,
        entered: entered.has(g.id),
        entryCount: entryCounts[i],
        winner: null,
      })),
    });
  })
);

export default router;
