import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config, paths } from "./config";
import { errorHandler, notFoundHandler, ApiError } from "./lib/errors";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import walletRoutes from "./routes/wallet.routes";
import storeRoutes from "./routes/store.routes";
import serverRoutes from "./routes/server.routes";
import billingRoutes from "./routes/billing.routes";
import ticketRoutes from "./routes/ticket.routes";
import notificationRoutes from "./routes/notification.routes";
import adminRoutes from "./routes/admin.routes";
import publicRoutes from "./routes/public.routes";

// Origins allowed to call the API. The Next.js app proxies /api server-side,
// so in development we accept any origin (localhost on any port, tunnel
// hostnames, etc.) while production enforces the configured allowlist.
function isAllowedOrigin(origin: string): boolean {
  if (config.corsOrigin.includes(origin)) return true;
  return config.env !== "production";
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  // ---- Security middleware ----
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || isAllowedOrigin(origin)) return cb(null, true);
        return cb(new ApiError(403, "CORS_BLOCKED", "Origin not allowed"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());

  // Global rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests, slow down" } },
    })
  );

  // CSRF defense: same-site cookies + Origin verification on state-changing requests
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !isAllowedOrigin(origin)) {
        return next(new ApiError(403, "INVALID_ORIGIN", "Request origin rejected"));
      }
    }
    next();
  });

  // ---- Static uploads (for development — file uploads should use the panel) ----
  app.use("/uploads", express.static(paths.uploads));

  // ---- Routes ----
  app.get("/api/health", (_req, res) => res.json({ ok: true, data: { status: "up", time: new Date().toISOString() } }));
  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/store", storeRoutes);
  app.use("/api/servers", serverRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
