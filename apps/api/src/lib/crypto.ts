import crypto from "crypto";
import { config } from "../config";

function key(): Buffer {
  // Derive a 32-byte key from ENCRYPTION_KEY (accepts hex or raw)
  const raw = config.encryptionKey || "nova-panel-insecure-key";
  const hex = Buffer.from(raw, "hex");
  if (hex.length === 32) return hex;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return payload;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function isEncrypted(payload: string): boolean {
  return typeof payload === "string" && payload.split(".").length === 3;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function shortId(len = 8): string {
  return crypto.randomBytes(len).toString("hex").slice(0, len);
}

/** Cryptographically-secure integer in [0, floor(maxExclusive)). */
export function randomInt(maxExclusive: number): number {
  const max = Math.floor(maxExclusive);
  if (max <= 1) return 0;
  return crypto.randomInt(0, max);
}

/** Stable pseudo-random generator for demo-mode determinism. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
