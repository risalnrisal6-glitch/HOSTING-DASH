import { Response } from "express";
import { prisma } from "../db";
import { settings } from "./settings";

// In-memory SSE subscriber registry: userId -> Set<Response>
const subscribers = new Map<string, Set<Response>>();

export function subscribeSse(userId: string, res: Response): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(res);
  return () => {
    set?.delete(res);
    if (set && set.size === 0) subscribers.delete(userId);
  };
}

function push(userId: string, payload: unknown): void {
  const set = subscribers.get(userId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      /* ignore */
    }
  }
}

export interface NotifyInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Creates a notification for a user and pushes it over SSE in realtime. */
export async function notifyUser(userId: string, input: NotifyInput): Promise<void> {
  try {
    const n = await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: JSON.stringify(input.data ?? {}),
      },
    });
    push(userId, n);
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}

/** Announces to every user (used for announcements, giveaways). */
export async function broadcast(input: NotifyInput): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  // notifyUser never rejects (errors are swallowed internally), so fan out in
  // parallel instead of serializing one DB insert per user.
  await Promise.all(users.map((u) => notifyUser(u.id, input)));
}

/** Site config helper used by notification content. */
export async function siteName(): Promise<string> {
  return String((await settings.get("site_name")) || "NOVA PANEL");
}
