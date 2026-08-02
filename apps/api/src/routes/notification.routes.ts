import { Router } from "express";
import { asyncH } from "../lib/errors";
import { requireAuth, AuthedRequest } from "../lib/rbac";
import { prisma } from "../db";
import { subscribeSse } from "../services/notify.service";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncH(async (req, res) => {
    const userId = (req as AuthedRequest).user.id;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 15), 50);
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    res.json({ ok: true, data: { items, total, unread, pages: Math.ceil(total / limit), page } });
  })
);

router.post(
  "/read",
  asyncH(async (req, res) => {
    const userId = (req as AuthedRequest).user.id;
    const ids = (req.body?.ids as string[]) ?? [];
    if (ids.length === 0) {
      await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    } else {
      await prisma.notification.updateMany({ where: { id: { in: ids }, userId }, data: { readAt: new Date() } });
    }
    res.json({ ok: true });
  })
);

// Real-time notification stream (SSE)
router.get("/stream", asyncH(async (req, res) => {
  const userId = (req as AuthedRequest).user.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25000);
  const unsubscribe = subscribeSse(userId, res);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}));

export default router;
