import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static badRequest(msg: string, fields?: Record<string, string>) {
    return new ApiError(400, "BAD_REQUEST", msg, fields);
  }
  static unauthorized(msg = "Authentication required") {
    return new ApiError(401, "UNAUTHORIZED", msg);
  }
  static forbidden(msg = "You do not have permission") {
    return new ApiError(403, "FORBIDDEN", msg);
  }
  static notFound(msg = "Not found") {
    return new ApiError(404, "NOT_FOUND", msg);
  }
  static conflict(msg: string) {
    return new ApiError(409, "CONFLICT", msg);
  }
  static tooMany(msg = "Too many requests") {
    return new ApiError(429, "RATE_LIMITED", msg);
  }
  static internal(msg = "Internal server error") {
    return new ApiError(500, "INTERNAL", msg);
  }
}

/** Wraps an async route handler so rejections reach the error middleware. */
export const asyncH =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "value";
      if (!fields[key]) fields[key] = issue.message;
    }
    return res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", fields } });
  }
  // multer errors
  const anyErr = err as { message?: string; code?: string };
  if (anyErr?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ ok: false, error: { code: "FILE_TOO_LARGE", message: "File too large" } });
  }
  console.error("[unhandled]", err);
  return res.status(500).json({ ok: false, error: { code: "INTERNAL", message: "Internal server error" } });
}
