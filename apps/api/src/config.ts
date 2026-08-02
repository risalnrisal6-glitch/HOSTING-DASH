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
