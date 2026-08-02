import { ZodType, z } from "zod";
import { Request } from "express";
import { ApiError } from "./errors";

export function validateBody<S extends z.ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const result = schema.safeParse(req.body);
  if (!result.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid input", fieldErrors(result.error));
  return result.data;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "value";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

// ---- Shared schemas ----
export const idSchema = z.object({
  id: z.string().min(1, "Required"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().optional().default(""),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-zA-Z]/, "Must contain a letter")
  .regex(/[0-9]/, "Must contain a number");

export const emailSchema = z.string().email("Invalid email address").max(190);

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, _ . - allowed");

export const limitsSchema = z.object({
  ram: z.number().int().min(64).max(262144).default(1024),
  swap: z.number().int().min(0).max(32768).default(0),
  disk: z.number().int().min(256).max(1048576).default(10240),
  io: z.number().int().min(10).max(1000).default(500),
  cpu: z.number().int().min(0).max(400).default(100),
});

export const featureLimitsSchema = z.object({
  databases: z.number().int().min(0).max(100).default(1),
  allocations: z.number().int().min(0).max(100).default(1),
  backups: z.number().int().min(0).max(100).default(1),
});
