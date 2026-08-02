import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { settings } from "./settings";
import { ApiError } from "../lib/errors";
import { randomToken } from "../lib/crypto";
import { signAccessToken, signRefreshToken, signTwoFactorToken, verifyRefreshToken, verifyTwoFactorToken, AccessPayload } from "../lib/jwt";
import { sendMail, renderLayout } from "../lib/mailer";
import { wallet } from "./wallet.service";
import { audit } from "../lib/audit";

const TOKEN_TTL_MS = 24 * 3600 * 1000; // links in emails say "expires in 24 hours"

function publicUser(u: {
  id: string; email: string; username: string; avatar: string | null; role: string; status: string;
  balance: number; coins: number; bonusCoins: number; referralCode: string | null; emailVerifiedAt: Date | null;
  twoFactorEnabled: boolean; createdAt: Date; lastLoginAt: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatar: u.avatar,
    role: u.role,
    status: u.status,
    balance: u.balance,
    coins: u.coins,
    bonusCoins: u.bonusCoins,
    referralCode: u.referralCode,
    emailVerified: !!u.emailVerifiedAt,
    twoFactorEnabled: u.twoFactorEnabled,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;

function generateReferralCode(username: string): string {
  const base = username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return (base || "NOVA") + randomToken(4).toUpperCase().slice(0, 4);
}

/** Grants the admin-configurable welcome bonus (coins) on first signup. */
async function grantWelcomeBonus(userId: string): Promise<void> {
  if ((await settings.get("welcome_bonus_enabled")) !== true) return;
  const amount = Math.max(0, Math.round(Number((await settings.get("welcome_bonus_coins")) ?? 100) || 0));
  if (amount <= 0) return;
  await wallet.creditCoins(userId, amount, "Welcome bonus 🎉", "welcome_bonus");
}

export async function register(input: { email: string; username: string; password: string; referralCode?: string }) {
  const registrationEnabled = await settings.get("security_registration");
  if (registrationEnabled === false) throw ApiError.forbidden("Registration is currently disabled");

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username: input.username }] } });
  if (existing) {
    if (existing.email === email) throw ApiError.conflict("An account with this email already exists");
    throw ApiError.conflict("Username already taken");
  }

  const hash = await bcrypt.hash(input.password, 12);
  const emailVerify = (await settings.get("security_email_verify")) === true;
  const verifyToken = emailVerify ? randomToken(24) : null;

  let referredBy: { id: string } | null = null;
  if (input.referralCode) {
    referredBy = await prisma.user.findUnique({ where: { referralCode: input.referralCode.trim().toUpperCase() } });
  }

  const user = await prisma.user.create({
    data: {
      email,
      username: input.username,
      passwordHash: hash,
      referralCode: generateReferralCode(input.username),
      verifyToken,
      verifyTokenExpiresAt: verifyToken ? new Date(Date.now() + TOKEN_TTL_MS) : null,
      referredById: referredBy?.id,
      avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.username)}&backgroundColor=6366f1,8b5cf6,3b82f6`,
    },
  });

  // Welcome bonus (admin-configurable)
  await grantWelcomeBonus(user.id);

  // Referral rewards
  if (referredBy) {
    const refCfg = (await settings.get("referral")) as { referrer: number; referred: number; enabled: boolean } | undefined;
    const refReward = refCfg?.referred ?? 25;
    const referrerReward = refCfg?.referrer ?? 50;
    const rewardNow = !emailVerify; // referrer gets paid when the new user verifies (or instantly if no verification)
    const status = rewardNow ? "paid" : "pending";
    const referral = await prisma.referral.create({
      data: {
        referrerId: referredBy.id,
        referredId: user.id,
        rewardReferrer: referrerReward,
        rewardReferred: refReward,
        status,
        paidAt: rewardNow ? new Date() : null,
      },
    });
    await wallet.creditCoins(user.id, refReward, "Welcome bonus — referral reward", "referral", referral.id);
    if (rewardNow) {
      await wallet.creditCoins(referredBy.id, referrerReward, "Referral reward — new user joined", "referral", referral.id);
      await prisma.referral.update({ where: { id: referral.id }, data: { status: "paid", paidAt: new Date() } });
    }
  }

  if (emailVerify && verifyToken) {
    const site = await settings.get("site_name");
    const link = `${process.env.PUBLIC_URL || "http://localhost:3000"}/verify-email?token=${verifyToken}`;
    await sendMail(user.email, `Verify your ${site} account`, renderLayout("Verify your email", `
      <p>Hi <strong>${user.username}</strong>, welcome to <strong>${site}</strong>!</p>
      <p>Confirm your email address to activate your account:</p>
      <p style="text-align:center"><a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#8b5cf6,#3b82f6);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none">Verify Email</a></p>
      <p style="color:#94a3b8;font-size:13px">This link expires in 24 hours.</p>`));
  }

  // Re-fetch so the response reflects the welcome bonus credit
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  return publicUser(fresh ?? user);
}

export async function login(email: string, password: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid email or password");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized("Invalid email or password");
  if (user.status === "banned") throw ApiError.forbidden("Your account has been banned");
  if (user.twoFactorEnabled) {
    // Issue a short-lived single-purpose temp token; user must complete 2FA.
    // NOT a refresh token — it can never be exchanged via /auth/refresh.
    const temp = signTwoFactorToken(user.id);
    return { needsTwoFactor: true as const, tempToken: temp, userId: user.id };
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(null, "auth.login", "user", user.id, { email, ip });
  return { needsTwoFactor: false as const, tokens: issueTokens(user.id, user.role), user: publicUser(user) };
}

function issueTokens(userId: string, role: string) {
  return { accessToken: signAccessToken(userId, role), refreshToken: signRefreshToken(userId) };
}

export async function completeTwoFactor(tempToken: string, code: string) {
  const payload = verifyTwoFactorToken(tempToken);
  if (!payload) throw ApiError.unauthorized("2FA session expired, please sign in again");
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw ApiError.unauthorized("2FA not enabled");
  const otplib = await import("otplib");
  const valid = otplib.authenticator.check(code.replace(/\s/g, ""), user.twoFactorSecret);
  if (!valid) throw ApiError.unauthorized("Invalid 2FA code");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { tokens: issueTokens(user.id, user.role), user: publicUser(user) };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw ApiError.unauthorized("Session expired");
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === "banned") throw ApiError.unauthorized("Account unavailable");
  return { accessToken: signAccessToken(user.id, user.role), user: publicUser(user) };
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({ where: { verifyToken: token } });
  if (!user) throw ApiError.badRequest("Invalid or expired verification link");
  if (user.verifyTokenExpiresAt && user.verifyTokenExpiresAt < new Date()) throw ApiError.badRequest("Verification link has expired");
  await prisma.user.update({ where: { id: user.id }, data: { verifyToken: null, verifyTokenExpiresAt: null, emailVerifiedAt: new Date() } });

  // Pay pending referral rewards
  const pending = await prisma.referral.findMany({ where: { referredId: user.id, status: "pending" } });
  for (const ref of pending) {
    await wallet.creditCoins(ref.referrerId, ref.rewardReferrer, "Referral reward — referred user verified", "referral", ref.id);
    await prisma.referral.update({ where: { id: ref.id }, data: { status: "paid", paidAt: new Date() } });
  }
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound();
  if (user.emailVerifiedAt) throw ApiError.badRequest("Email already verified");
  const token = randomToken(24);
  await prisma.user.update({ where: { id: user.id }, data: { verifyToken: token, verifyTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) } });
  const site = await settings.get("site_name");
  const link = `${process.env.PUBLIC_URL || "http://localhost:3000"}/verify-email?token=${token}`;
  await sendMail(user.email, `Verify your ${site} account`, renderLayout("Verify your email", `
    <p>Hi <strong>${user.username}</strong>, here's a fresh verification link:</p>
    <p style="text-align:center"><a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#8b5cf6,#3b82f6);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none">Verify Email</a></p>`));
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Always respond the same to avoid user enumeration
  if (!user) return;
  const token = randomToken(24);
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) } });
  const site = await settings.get("site_name");
  const link = `${process.env.PUBLIC_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  await sendMail(user.email, `Reset your ${site} password`, renderLayout("Reset password", `
    <p>Hi <strong>${user.username}</strong>, we received a request to reset your password.</p>
    <p style="text-align:center"><a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#8b5cf6,#3b82f6);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none">Reset Password</a></p>
    <p style="color:#94a3b8;font-size:13px">This link expires in 24 hours. If you didn't request this, ignore this email.</p>`));
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { resetToken: token } });
  if (!user) throw ApiError.badRequest("Invalid or expired reset link");
  if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) throw ApiError.badRequest("Reset link has expired");
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, resetToken: null, resetTokenExpiresAt: null } });
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound();
  if (user.passwordHash && !(await bcrypt.compare(current, user.passwordHash))) {
    throw ApiError.badRequest("Current password is incorrect");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
}

// ---------- 2FA setup ----------

export async function setupTwoFactor(userId: string) {
  const otplib = await import("otplib");
  const secret = otplib.authenticator.generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const otpauth = otplib.authenticator.keyuri(user!.email, "NOVA PANEL", secret);
  const qr = await import("qrcode");
  const qrDataUrl = await qr.toDataURL(otpauth);
  return { secret, otpauth, qrDataUrl };
}

export async function enableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw ApiError.badRequest("Start 2FA setup first");
  const otplib = await import("otplib");
  if (!otplib.authenticator.check(code.replace(/\s/g, ""), user.twoFactorSecret)) {
    throw ApiError.badRequest("Invalid 2FA code");
  }
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
}

export async function disableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw ApiError.badRequest("2FA is not enabled");
  const otplib = await import("otplib");
  if (!otplib.authenticator.check(code.replace(/\s/g, ""), user.twoFactorSecret)) {
    throw ApiError.badRequest("Invalid 2FA code");
  }
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
}

// ---------- OAuth ----------

async function oauthToken(provider: "discord" | "google", code: string): Promise<Record<string, string>> {
  const s = await settings.getAll();
  const redirect = provider === "discord"
    ? String(s.oauth_discord_redirect || `${process.env.PUBLIC_URL || "http://localhost:3000"}/auth/callback/discord`)
    : String(s.oauth_google_redirect || `${process.env.PUBLIC_URL || "http://localhost:3000"}/auth/callback/google`);
  const body =
    provider === "discord"
      ? { client_id: s.oauth_discord_client_id, client_secret: s.oauth_discord_client_secret, grant_type: "authorization_code", code, redirect_uri: redirect }
      : { client_id: s.oauth_google_client_id, client_secret: s.oauth_google_client_secret, grant_type: "authorization_code", code, redirect_uri: redirect };
  const url = provider === "discord" ? "https://discord.com/api/oauth2/token" : "https://oauth2.googleapis.com/token";
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.set(k, String(v ?? ""));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!res.ok) throw ApiError.unauthorized("OAuth exchange failed");
  return (await res.json()) as Record<string, string>;
}

async function fetchProfile(provider: "discord" | "google", tokens: Record<string, string>) {
  if (provider === "discord") {
    const res = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!res.ok) throw ApiError.unauthorized("Could not fetch Discord profile");
    const p = (await res.json()) as { id: string; username: string; global_name?: string; avatar?: string };
    const avatar = p.avatar
      ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=128`
      : `https://api.dicebear.com/9.x/initials/svg?seed=${p.username}`;
    return { oauthId: `discord:${p.id}`, email: `${p.id}@discord.local`, username: p.global_name || p.username, avatar };
  }
  const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${tokens.id_token}`);
  if (!res.ok) throw ApiError.unauthorized("Could not fetch Google profile");
  const p = (await res.json()) as { sub: string; email: string; name?: string; email_verified?: string; picture?: string };
  return {
    oauthId: `google:${p.sub}`,
    email: p.email.toLowerCase(),
    username: (p.name || p.email.split("@")[0]).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 20) || "user",
    avatar: p.picture,
  };
}

export async function oauthLogin(provider: "discord" | "google", code: string) {
  const s = await settings.getAll();
  const enabled = provider === "discord" ? s.oauth_discord_enabled : s.oauth_google_enabled;
  if (!enabled) throw ApiError.forbidden(`${provider} login is disabled`);
  const tokens = await oauthToken(provider, code);
  const profile = await fetchProfile(provider, tokens);

  let user = await prisma.user.findFirst({ where: { OR: [{ email: profile.email }, { username: profile.username }] } });
  if (!user) {
    const registrationEnabled = await settings.get("security_registration");
    if (registrationEnabled === false) throw ApiError.forbidden("Registration is currently disabled");
    user = await prisma.user.create({
      data: {
        email: profile.email,
        username: profile.username,
        avatar: profile.avatar,
        emailVerifiedAt: new Date(),
        referralCode: generateReferralCode(profile.username),
        // oauth id encoded in a private marker for future linking
        permissions: JSON.stringify([`oauth:${profile.oauthId}`]),
      },
    });
    await grantWelcomeBonus(user.id);
  }
  if (user.status === "banned") throw ApiError.forbidden("Your account has been banned");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { tokens: issueTokens(user.id, user.role), user: publicUser(user) };
}

export { publicUser, issueTokens, AccessPayload };
