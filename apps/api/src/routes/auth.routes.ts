import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncH, ApiError } from "../lib/errors";
import { validateBody } from "../lib/validate";
import { z } from "zod";
import * as auth from "../services/auth.service";
import { requireAuth } from "../lib/rbac";
import { passwordSchema, emailSchema, usernameSchema } from "../lib/validate";
import { audit } from "../lib/audit";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function setTokens(res: any, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie("nova_access", tokens.accessToken, { ...COOKIE_OPTS, maxAge: 7 * 86400000 });
  res.cookie("nova_refresh", tokens.refreshToken, { ...COOKIE_OPTS, maxAge: 30 * 86400000 });
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: "draft-7", legacyHeaders: false });

// ---- Register ----
router.post(
  "/register",
  authLimiter,
  asyncH(async (req, res) => {
    const data = validateBody(
      z.object({
        email: emailSchema,
        username: usernameSchema,
        password: passwordSchema,
        referralCode: z.string().optional(),
      }),
      req
    );
    const user = await auth.register(data);
    await audit(req, "auth.register", "user", user.id, { email: user.email });
    res.status(201).json({ ok: true, data: user });
  })
);

// ---- Login ----
router.post(
  "/login",
  authLimiter,
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ email: emailSchema, password: z.string().min(1) }), req);
    const result = await auth.login(data.email, data.password, req.ip);
    if (result.needsTwoFactor) {
      return res.json({ ok: true, data: { needsTwoFactor: true, userId: result.userId, tempToken: result.tempToken } });
    }
    setTokens(res, result.tokens!);
    res.json({ ok: true, data: { needsTwoFactor: false, user: result.user } });
  })
);

// ---- 2FA completion ----
router.post(
  "/two-factor",
  authLimiter,
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ tempToken: z.string().min(1), code: z.string().min(6).max(8) }), req);
    const result = await auth.completeTwoFactor(data.tempToken, data.code);
    setTokens(res, result.tokens);
    await audit(req, "auth.two_factor", "user", result.user.id);
    res.json({ ok: true, data: { user: result.user } });
  })
);

// ---- Refresh ----
router.post(
  "/refresh",
  asyncH(async (req, res) => {
    const token = (req.cookies as Record<string, string>)?.nova_refresh;
    if (!token) throw ApiError.unauthorized("No refresh token");
    const result = await auth.refresh(token);
    res.cookie("nova_access", result.accessToken, { ...COOKIE_OPTS, maxAge: 7 * 86400000 });
    res.json({ ok: true, data: { user: result.user } });
  })
);

// ---- Logout ----
router.post("/logout", (req, res) => {
  res.clearCookie("nova_access", COOKIE_OPTS);
  res.clearCookie("nova_refresh", COOKIE_OPTS);
  res.json({ ok: true });
});

// ---- Verify email ----
router.post(
  "/verify-email",
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ token: z.string().min(1) }), req);
    await auth.verifyEmail(data.token);
    res.json({ ok: true, data: { verified: true } });
  })
);

router.post(
  "/resend-verification",
  requireAuth,
  asyncH(async (req, res) => {
    await auth.resendVerification((req as any).user.id);
    res.json({ ok: true });
  })
);

// ---- Forgot / reset password ----
router.post(
  "/forgot-password",
  authLimiter,
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ email: emailSchema }), req);
    await auth.forgotPassword(data.email);
    res.json({ ok: true, data: { message: "If that email exists, a reset link was sent." } });
  })
);

router.post(
  "/reset-password",
  authLimiter,
  asyncH(async (req, res) => {
    const data = validateBody(z.object({ token: z.string().min(1), password: passwordSchema }), req);
    await auth.resetPassword(data.token, data.password);
    res.json({ ok: true });
  })
);

// ---- OAuth ----
router.post(
  "/oauth/:provider",
  authLimiter,
  asyncH(async (req, res) => {
    const provider = req.params.provider as "discord" | "google";
    if (!["discord", "google"].includes(provider)) throw ApiError.badRequest("Unknown provider");
    const data = validateBody(z.object({ code: z.string().min(1) }), req);
    const result = await auth.oauthLogin(provider, data.code);
    setTokens(res, result.tokens);
    await audit(req, `auth.oauth.${provider}`, "user", result.user.id);
    res.json({ ok: true, data: { user: result.user } });
  })
);

export default router;
