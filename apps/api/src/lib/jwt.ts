import jwt from "jsonwebtoken";
import { config } from "../config";
import { randomToken } from "./crypto";

export interface AccessPayload {
  sub: string; // user id
  role: string;
  jti: string;
}

export interface RefreshPayload {
  sub: string;
  typ: "refresh";
}

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role, jti: randomToken(8) } as AccessPayload, config.jwtSecret, {
    expiresIn: "7d",
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "refresh" } as RefreshPayload, config.jwtRefreshSecret, { expiresIn: "30d" });
}

/**
 * Short-lived single-purpose token for completing 2FA.
 * Signed with a different `typ` than refresh tokens so it can NEVER be
 * exchanged via /auth/refresh — otherwise 2FA would be bypassable by
 * replaying the login temp token against the refresh endpoint.
 */
export function signTwoFactorToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "twofactor" }, config.jwtRefreshSecret, { expiresIn: "5m" });
}

export function verifyTwoFactorToken(token: string): RefreshPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret) as jwt.JwtPayload;
    if (payload.typ !== "twofactor") return null;
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AccessPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret) as jwt.JwtPayload;
    if (payload.typ !== "refresh") return null;
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}
