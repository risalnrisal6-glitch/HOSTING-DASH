import { Router } from "express";
import { asyncH, ApiError } from "../lib/errors";
import { requireAuth, requireRole, requirePermission, AuthedRequest } from "../lib/rbac";
import { z } from "zod";
import { validateBody } from "../lib/validate";
import * as admin from "../services/admin.service";
import { prisma } from "../db";
import { settings, isSensitiveKey } from "../services/settings";
import * as ptero from "../lib/pterodactyl";
import { audit } from "../lib/audit";
import { wallet } from "../services/wallet.service";

const router = Router();
router.use(requireAuth);
router.use(requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));

const ME = (req: any) => (req as AuthedRequest).user;

// ---------- Dashboard ----------
router.get("/dashboard", requirePermission("dashboard.view"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await admin.dashboardStats() });
}));

// ---------- Users ----------
router.get("/users", requirePermission("users.view"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 15), 100);
  const search = String(req.query.search || "");
  res.json({ ok: true, data: await admin.listUsers(page, limit, search) });
}));

router.get("/users/:id", requirePermission("users.view"), asyncH(async (req, res) => {
  res.json({ ok: true, data: await admin.getUserAdmin(req.params.id) });
}));

router.patch("/users/:id/role", requirePermission("users.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ role: z.string().min(1), status: z.string().optional() }), req);
  const user = await admin.updateUserRole(req.params.id, data.role, data.status);
  await audit(req, "admin.user.role", "user", user.id, { role: data.role, by: ME(req).username });
  res.json({ ok: true, data: user });
}));

router.post("/users/:id/ban", requirePermission("users.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ ban: z.boolean() }), req);
  const user = await admin.banUser(req.params.id, data.ban);
  await audit(req, `admin.user.${data.ban ? "ban" : "unban"}`, "user", user.id, { by: ME(req).username });
  res.json({ ok: true, data: user });
}));

router.delete("/users/:id", requirePermission("settings.super"), asyncH(async (req, res) => {
  await admin.deleteUser(req.params.id);
  await audit(req, "admin.user.delete", "user", req.params.id, { by: ME(req).username });
  res.json({ ok: true });
}));

// ---------- User grants ----------
router.post("/users/:id/grant", requirePermission("coins.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ currency: z.enum(["AKF", "balance"]), amount: z.number().positive(), reason: z.string().max(200) }), req);
  if (data.currency === "AKF") await wallet.creditCoins(req.params.id, Math.round(data.amount), `Admin grant: ${data.reason}`, "admin");
  else await wallet.creditBalance(req.params.id, data.amount, `Admin grant: ${data.reason}`, "admin");
  await audit(req, "admin.user.grant", "user", req.params.id, { currency: data.currency, amount: data.amount });
  res.json({ ok: true });
}));

// ---------- Servers ----------
router.get("/servers", requirePermission("servers.view_all"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 15), 100);
  const search = String(req.query.search || "");
  res.json({ ok: true, data: await admin.listServersAdmin(page, limit, search) });
}));

router.post("/servers/:id/suspend", requirePermission("servers.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ suspend: z.boolean() }), req);
  const server = await admin.adminSuspendServer(req.params.id, data.suspend);
  await audit(req, `admin.server.${data.suspend ? "suspend" : "unsuspend"}`, "server", req.params.id);
  res.json({ ok: true, data: server });
}));

// ---------- Plans ----------
router.get("/plans", asyncH(async (req, res) => {
  const { listPlans } = await import("../services/store.service");
  res.json({ ok: true, data: await listPlans(false) });
}));

router.post("/plans", requirePermission("plans.manage"), asyncH(async (req, res) => {
  const plan = await admin.upsertPlan(req.body);
  await audit(req, "admin.plan.create", "plan", plan.id, { name: plan.name });
  res.status(201).json({ ok: true, data: plan });
}));

router.patch("/plans/:id", requirePermission("plans.manage"), asyncH(async (req, res) => {
  const plan = await admin.upsertPlan(req.body, req.params.id);
  await audit(req, "admin.plan.update", "plan", plan.id);
  res.json({ ok: true, data: plan });
}));

router.delete("/plans/:id", requirePermission("plans.manage"), asyncH(async (req, res) => {
  await admin.deletePlan(req.params.id);
  await audit(req, "admin.plan.delete", "plan", req.params.id);
  res.json({ ok: true });
}));

// ---------- Shop items ----------
router.get("/shop", asyncH(async (_req, res) => {
  const { listShopItems } = await import("../services/store.service");
  res.json({ ok: true, data: await listShopItems(false) });
}));

router.put("/shop/:type", requirePermission("shop.manage"), asyncH(async (req, res) => {
  const data = validateBody(
    z.object({
      name: z.string().min(1), unit: z.string().min(1), price: z.number().min(0),
      minUnits: z.number().int().min(1).default(1), maxPerUser: z.number().int().min(1).default(50),
      stock: z.number().int().min(-1).default(-1), discount: z.number().int().min(0).max(90).default(0),
      enabled: z.boolean().default(true), sort: z.number().int().default(0),
    }),
    req
  );
  const item = await admin.upsertShopItem({ type: req.params.type, ...data });
  await audit(req, "admin.shop.update", "shopItem", item.id);
  res.json({ ok: true, data: item });
}));

// ---------- Coupons ----------
router.get("/coupons", requirePermission("coupons.manage"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } }) });
}));

router.post("/coupons", requirePermission("coupons.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({
    code: z.string().min(3).max(32), type: z.enum(["percent", "fixed"]), value: z.number().positive(),
    minAmount: z.number().default(0), maxUses: z.number().int().default(0), perUserLimit: z.number().int().default(0),
    expiresAt: z.string().optional().nullable(), enabled: z.boolean().default(true), description: z.string().optional(),
  }), req);
  const promo = await admin.upsertPromo(data);
  await audit(req, "admin.coupon.create", "promoCode", promo.id, { code: promo.code });
  res.status(201).json({ ok: true, data: promo });
}));

router.patch("/coupons/:id", requirePermission("coupons.manage"), asyncH(async (req, res) => {
  const promo = await admin.upsertPromo(req.body, req.params.id);
  await audit(req, "admin.coupon.update", "promoCode", promo.id);
  res.json({ ok: true, data: promo });
}));

router.delete("/coupons/:id", requirePermission("coupons.manage"), asyncH(async (req, res) => {
  await prisma.promoCode.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Rewards config ----------
router.get("/rewards", requirePermission("rewards.manage"), asyncH(async (_req, res) => {
  const keys = ["daily_checkin", "weekly_checkin", "monthly_checkin", "ad_watch", "referral", "vote", "spin_wheel"];
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = await settings.get(key);
  res.json({ ok: true, data: out });
}));

router.put("/rewards/:key", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  const allowed = ["daily_checkin", "weekly_checkin", "monthly_checkin", "ad_watch", "referral", "vote", "spin_wheel"];
  if (!allowed.includes(req.params.key)) throw ApiError.badRequest("Unknown reward key");
  const value = await (req.params.key === "spin_wheel" ? admin.saveWheelConfig(req.body) : admin.saveRewardSetting(req.params.key, req.body));
  await audit(req, "admin.rewards.update", "reward", req.params.key);
  res.json({ ok: true, data: value });
}));

// ---------- Tasks ----------
router.get("/tasks", requirePermission("rewards.manage"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await prisma.task.findMany({ orderBy: { sort: "asc" } }) });
}));

router.post("/tasks", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  const task = await admin.upsertTask(req.body);
  res.status(201).json({ ok: true, data: task });
}));

router.patch("/tasks/:id", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  const task = await admin.upsertTask(req.body, req.params.id);
  res.json({ ok: true, data: task });
}));

router.delete("/tasks/:id", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Giveaways ----------
router.get("/giveaways", requirePermission("rewards.manage"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await prisma.giveaway.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { entries: true } } } }) });
}));

router.post("/giveaways", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  const g = await admin.upsertGiveaway(req.body);
  res.status(201).json({ ok: true, data: g });
}));

router.patch("/giveaways/:id", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  const g = await admin.upsertGiveaway(req.body, req.params.id);
  res.json({ ok: true, data: g });
}));

router.post("/giveaways/:id/draw", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  const g = await admin.drawGiveaway(req.params.id);
  await audit(req, "admin.giveaway.draw", "giveaway", req.params.id, { winner: g.winner });
  res.json({ ok: true, data: g });
}));

router.delete("/giveaways/:id", requirePermission("rewards.manage"), asyncH(async (req, res) => {
  await prisma.giveaway.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Tickets (staff view) ----------
router.get("/tickets", requirePermission("tickets.manage"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 15), 100);
  const status = String(req.query.status || "all");
  const where = status && status !== "all" ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit, include: { user: { select: { username: true, avatar: true } } } }),
    prisma.ticket.count({ where }),
  ]);
  res.json({ ok: true, data: { items, total, pages: Math.ceil(total / limit), page } });
}));

// ---------- Payments ----------
router.get("/payments", requirePermission("payments.manage"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 15), 100);
  const status = String(req.query.status || "all");
  res.json({ ok: true, data: await admin.listPayments(page, limit, status) });
}));

router.post("/payments/:id/approve", requirePermission("payments.manage"), asyncH(async (req, res) => {
  const invoice = await admin.approvePayment(req.params.id, ME(req).id);
  await audit(req, "admin.payment.approve", "invoice", req.params.id, { by: ME(req).username });
  res.json({ ok: true, data: invoice });
}));

router.post("/payments/:id/refuse", requirePermission("payments.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ note: z.string().max(500).default("") }), req);
  const invoice = await admin.refusePayment(req.params.id, data.note);
  res.json({ ok: true, data: invoice });
}));

router.get("/refunds", requirePermission("payments.manage"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 15), 100);
  res.json({ ok: true, data: await admin.listRefunds(page, limit) });
}));

router.post("/refunds/:id/resolve", requirePermission("payments.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ approve: z.boolean(), note: z.string().max(500).default("") }), req);
  const refund = await admin.resolveRefund(req.params.id, data.approve, data.note);
  await audit(req, `admin.refund.${data.approve ? "approve" : "reject"}`, "refund", req.params.id);
  res.json({ ok: true, data: refund });
}));

// ---------- Panel data (eggs & nests, nodes, locations) ----------
router.get("/panel", requirePermission("panel.sync"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await admin.panelSync() });
}));

router.post("/panel/sync", requirePermission("panel.sync"), asyncH(async (req, res) => {
  const data = await admin.panelSync();
  await audit(req, "admin.panel.sync", "panel");
  res.json({ ok: true, data });
}));

// ---------- Announcements ----------
router.get("/announcements", requirePermission("announcements.manage"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } }) });
}));

router.post("/announcements", requirePermission("announcements.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({
    title: z.string().min(1).max(120), body: z.string().min(1).max(5000),
    type: z.enum(["info", "warning", "update", "promo"]), active: z.boolean().default(true), notify: z.boolean().default(false),
  }), req);
  const a = await admin.createAnnouncement(data);
  await audit(req, "admin.announcement.create", "announcement", a.id);
  res.status(201).json({ ok: true, data: a });
}));

router.delete("/announcements/:id", requirePermission("announcements.manage"), asyncH(async (req, res) => {
  await admin.deleteAnnouncement(req.params.id);
  res.json({ ok: true });
}));

// ---------- Roles ----------
router.get("/roles", requirePermission("roles.manage"), asyncH(async (_req, res) => {
  res.json({ ok: true, data: await prisma.role.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { users: true } } } }) });
}));

router.post("/roles", requirePermission("roles.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({ name: z.string().min(2).max(32), description: z.string().optional(), permissions: z.array(z.string()) }), req);
  const role = await admin.upsertRole(data);
  await audit(req, "admin.role.create", "role", role.id);
  res.status(201).json({ ok: true, data: role });
}));

router.patch("/roles/:id", requirePermission("roles.manage"), asyncH(async (req, res) => {
  const role = await admin.upsertRole(req.body, req.params.id);
  res.json({ ok: true, data: role });
}));

router.delete("/roles/:id", requirePermission("roles.manage"), asyncH(async (req, res) => {
  await admin.deleteRole(req.params.id);
  res.json({ ok: true });
}));

// ---------- Logs ----------
router.get("/logs", requirePermission("logs.view"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 25), 100);
  const search = String(req.query.search || "");
  res.json({ ok: true, data: await admin.listLogs(page, limit, search) });
}));

// ---------- Mail outbox ----------
router.get("/outbox", requirePermission("settings.manage"), asyncH(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const [items, total] = await Promise.all([
    prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.emailOutbox.count(),
  ]);
  res.json({ ok: true, data: { items, total, pages: Math.ceil(total / limit), page } });
}));

// ---------- Settings ----------
router.get("/settings", requirePermission("settings.manage"), asyncH(async (_req, res) => {
  const all = await settings.getAll();
  res.json({ ok: true, data: all });
}));

router.put("/settings", requirePermission("settings.manage"), asyncH(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const allowed = Object.keys(body);
  await settings.setMany(body);
  await audit(req, "admin.settings.update", "settings", allowed.join(","));
  res.json({ ok: true, data: await settings.getAll() });
}));

// Test the Pterodactyl connection (single check button)
router.post("/settings/test-pterodactyl", requirePermission("settings.manage"), asyncH(async (req, res) => {
  const data = validateBody(z.object({
    url: z.string().url("Enter a valid panel URL (https://panel.example.com)"),
    appKey: z.string().min(10, "Application API key looks too short"),
    clientKey: z.string().default(""),
  }), req);
  const result = await ptero.testConnection(data.url, data.appKey, data.clientKey);
  await audit(req, "admin.settings.test_pterodactyl", "settings", data.url);
  res.json({ ok: true, data: result });
}));

// Test SMTP (single send-test button)
router.post("/settings/test-smtp", requirePermission("settings.manage"), asyncH(async (req, res) => {
  const { sendMail, renderLayout } = await import("../lib/mailer");
  const data = validateBody(z.object({ to: z.string().email() }), req);
  await settings.setMany({
    mail_host: String(req.body?.host ?? ""), mail_port: Number(req.body?.port ?? 587), mail_user: String(req.body?.user ?? ""),
    mail_pass: String(req.body?.pass ?? ""), mail_from: String(req.body?.from ?? ""), mail_secure: !!req.body?.secure,
  });
  const result = await sendMail(data.to, "NOVA PANEL — SMTP test", renderLayout("SMTP test", "<p>If you can read this email, your SMTP configuration is working correctly.</p>"));
  await audit(req, "admin.settings.test_smtp", "settings", data.to);
  res.json({ ok: true, data: result });
}));

export default router;
