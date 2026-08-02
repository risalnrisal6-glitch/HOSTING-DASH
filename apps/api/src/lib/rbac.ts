import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { verifyAccessToken } from "./jwt";
import { ApiError } from "./errors";

export type UserRole = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export interface AuthedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    status: string;
    permissions: string[];
  };
}

const ROLE_BASE_PERMISSIONS: Record<string, string[]> = {
  USER: [],
  MODERATOR: ["tickets.manage", "users.view", "servers.view_all", "logs.view"],
  ADMIN: ["*"],
  SUPER_ADMIN: ["*"],
};

const SUPER_ONLY = ["settings.super"];

/** Loads the fresh user row from DB on every request (ban/role changes apply immediately). */
async function loadUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: { roleModel: true } });
  if (!user) return null;
  const base = ROLE_BASE_PERMISSIONS[user.role] ?? [];
  const custom = user.roleModel ? (JSON.parse(user.roleModel.permissions || "[]") as string[]) : [];
  const overrides = JSON.parse(user.permissions || "[]") as string[];
  let effective = new Set([...base, ...custom, ...overrides.filter((p) => !p.startsWith("-"))]);
  for (const p of overrides) if (p.startsWith("-")) effective.delete(p.slice(1));
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role as UserRole,
    status: user.status,
    permissions: Array.from(effective),
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const cookie = (req.cookies as Record<string, string>)?.nova_access;
    const header = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
    const token = cookie || header;
    if (!token) throw ApiError.unauthorized();
    const payload = verifyAccessToken(token);
    if (!payload) throw ApiError.unauthorized("Session expired, please sign in again");
    const user = await loadUser(payload.sub);
    if (!user) throw ApiError.unauthorized();
    if (user.status === "banned") throw ApiError.forbidden("Your account has been banned");
    (req as AuthedRequest).user = user;
    next();
  } catch (e) {
    next(e);
  }
}

/** Allows the request to proceed anonymously; attaches user when a valid token exists. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = (req.cookies as Record<string, string>)?.nova_access;
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        const user = await loadUser(payload.sub);
        if (user && user.status !== "banned") (req as AuthedRequest).user = user;
      }
    }
    next();
  } catch {
    next();
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(ApiError.unauthorized());
    if (!roles.includes(user.role)) return next(ApiError.forbidden("Insufficient role"));
    next();
  };
}

export function requirePermission(perm: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(ApiError.unauthorized());
    if (user.role === "SUPER_ADMIN") return next();
    if (user.role === "ADMIN" && !SUPER_ONLY.includes(perm)) return next();
    if (user.permissions.includes(perm)) return next();
    return next(ApiError.forbidden(`Missing permission: ${perm}`));
  };
}

export function isStaff(req: Request): boolean {
  const user = (req as AuthedRequest).user;
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MODERATOR";
}
