import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : def;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL || "file:./dash.db",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim()),
  redisUrl: process.env.REDIS_URL || "",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "NOVA PANEL <no-reply@nova.panel>",
  },
  isProd: (process.env.NODE_ENV || "development") === "production",
  dataDir: path.resolve(__dirname, "../data"),
};

// Data directory used for uploads (ticket attachments, etc.)
export const paths = {
  uploads: path.join(config.dataDir, "uploads"),
};

// Refuse to boot a production instance with a missing, short, or well-known
// placeholder secret. The panel's source is public, so anyone reading it knows
// these defaults and could forge JWTs or decrypt data if they were ever used.
const PLACEHOLDER_SECRETS = new Set([
  "dev-jwt-secret",
  "dev-refresh-secret",
  "change-this-to-a-random-secret",
  "nova-panel-insecure-key",
]);

function assertStrongSecret(name: string, value: string, minLength = 32): void {
  const v = (value || "").trim().toLowerCase();
  if (!v || v.length < minLength || PLACEHOLDER_SECRETS.has(v)) {
    throw new Error(
      `[config] ${name} must be set to a strong random value (at least ${minLength} characters) in production. ` +
        `Refusing to start with a missing, short, or placeholder secret.`
    );
  }
}

if (config.isProd) {
  assertStrongSecret("JWT_SECRET", config.jwtSecret);
  assertStrongSecret("JWT_REFRESH_SECRET", config.jwtRefreshSecret);
  // ENCRYPTION_KEY may be 32-byte hex (64 chars) or a raw string; require a
  // real value so crypto.ts never falls back to its insecure default.
  assertStrongSecret("ENCRYPTION_KEY", config.encryptionKey, 16);
}
