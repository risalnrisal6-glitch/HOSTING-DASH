import { Router } from "express";
import { asyncH } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody, passwordSchema, usernameSchema } from "../lib/validate";
import { prisma } from "../db";
import { settings } from "../services/settings";
import * as auth from "../services/auth.service";
import { getUserServerSlots, listUserServers } from "../services/server.service";
import { wallet } from "../services/wallet.service";
import { getReferralStats } from "../services/referral.service";
import { audit } from "../lib/audit";
import { getCheckinStatus, afkEarn } from "../services/wallet.service";
import { safeJson } from "../lib/pterodactyl";

const router = Router();
router.use(requireAuth);

function pub(user: any) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    balance: user.balance,
    coins: user.coins,
    bonusCoins: user.bonusCoins,
    referralCode: user.referralCode,
    emailVerified: !!user.emailVerifiedAt,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ---- Me ----
router.get(
  "/me",
  asyncH(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: (req as AuthedRequest).user.id } });
    if (!user) throw new (await import("../lib/errors")).ApiError(404, "NOT_FOUND", "User not found");
    res.json({ ok: true, data: pub(user) });
  })
);

// ---- Dashboard summary ----
router.get(
  "/dashboard",
  asyncH(async (req, res) => {
    const userId = (req as AuthedRequest).user.id;
    const [user, servers, transactions, notifications, checkin, slots, announcements] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      listUserServers(userId),
      prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.notification.findMany({ where: { userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
      getCheckinStatus(userId),
      getUserServerSlots(userId),
      prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);
    if (!user) throw new (await import("../lib/errors")).ApiError(404, "NOT_FOUND", "User not found");
    const publicSettings = await settings.getPublic();
    const referral = await getReferralStats(userId).catch(() => null);
    res.json({
      ok: true,
      data: {
        user: pub(user),
        servers,
        slots,
        transactions,
        notifications,
        checkin,
        announcements,
        settings: publicSettings,
        referral,
        stats: {
          totalServers: servers.length,
          activeServers: servers.filter((s) => s.status === "RUNNING").length,
          offlineServers: servers.filter((s) => s.status === "OFFLINE").length,
          suspendedServers: servers.filter((s) => s.status === "SUSPENDED").length,
          totalRam: servers.reduce((a, s) => a + ((safeJson(s.limits).ram as number) || 0), 0),
          totalCpu: servers.reduce((a, s) => a + ((safeJson(s.limits).cpu as number) || 0), 0),
          totalDisk: servers.reduce((a, s) => a + ((safeJson(s.limits).disk as number) || 0), 0),
        },
      },
    });
  })
);

// ---- Update profile ----
router.patch(
  "/profile",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ username: usernameSchema.optional(), avatar: z.string().url().optional() }), req);
    const user = await prisma.user.update({ where: { id: (req as AuthedRequest).user.id }, data });
    await audit(req, "user.update_profile", "user", user.id);
    res.json({ ok: true, data: pub(user) });
  })
);

// ---- Change password ----
router.post(
  "/change-password",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ current: z.string().min(1), next: passwordSchema }), req);
    await auth.changePassword((req as AuthedRequest).user.id, data.current, data.next);
    await audit(req, "user.change_password", "user", (req as AuthedRequest).user.id);
    res.json({ ok: true });
  })
);

// ---- 2FA setup ----
router.post(
  "/2fa/setup",
  asyncH(async (req, res) => {
    const result = await auth.setupTwoFactor((req as AuthedRequest).user.id);
    res.json({ ok: true, data: result });
  })
);

router.post(
  "/2fa/enable",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ code: z.string().min(6).max(8) }), req);
    await auth.enableTwoFactor((req as AuthedRequest).user.id, data.code);
    res.json({ ok: true });
  })
);

router.post(
  "/2fa/disable",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ code: z.string().min(6).max(8) }), req);
    await auth.disableTwoFactor((req as AuthedRequest).user.id, data.code);
    res.json({ ok: true });
  })
);

// ---- AFK earning heartbeat ----
router.post(
  "/afk",
  asyncH(async (req, res) => {
    const result = await afkEarn((req as AuthedRequest).user.id);
    res.json({ ok: true, data: result });
  })
);

// ---- My transactions ----
router.get(
  "/transactions",
  asyncH(async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 15), 50);
    const data = await wallet.getTransactions((req as AuthedRequest).user.id, page, limit);
    res.json({ ok: true, data });
  })
);

export default router;
