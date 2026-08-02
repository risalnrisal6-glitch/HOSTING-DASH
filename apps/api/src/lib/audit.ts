import { Request } from "express";
import { prisma } from "../db";

/**
 * Records an audit log entry. Safe to call without await for performance,
 * but typically awaited in admin-critical actions.
 */
export async function audit(req: Request | null, action: string, entity?: string, entityId?: string, meta?: Record<string, unknown>) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: (req as { user?: { id: string } } | null)?.user?.id ?? null,
        username: (req as { user?: { username: string } } | null)?.user?.username ?? null,
        action,
        entity,
        entityId,
        meta: JSON.stringify(meta ?? {}),
        ip: req?.ip || null,
      },
    });
  } catch {
    /* audit must never break a request */
  }
}
