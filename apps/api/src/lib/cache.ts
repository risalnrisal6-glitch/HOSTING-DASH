import { config } from "../config";

// Cache abstraction: uses Redis when REDIS_URL is set, otherwise an in-memory Map.
// Keeps the dependency graph simple while remaining production-ready.

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

let redis: RedisLike | null = null;
let redisClient: unknown = null;

async function getRedis(): Promise<RedisLike | null> {
  if (redis) return redis;
  if (!config.redisUrl) return null;
  try {
    // @ts-ignore redis is optional (falls back to memory when not installed)
    const { createClient } = await import("redis");
    const client = (createClient as (opts: { url: string }) => { connect(): Promise<void> })({ url: config.redisUrl });
    await client.connect();
    redisClient = client;
    redis = client as unknown as RedisLike;
    return redis;
  } catch (e) {
    console.warn("[cache] Redis unavailable, falling back to memory:", e instanceof Error ? e.message : e);
    return null;
  }
}

const memory = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export const cache = {
  async get(key: string): Promise<string | null> {
    const r = await getRedis();
    if (r) return r.get(key);
    return memoryGet(key);
  },
  async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    const r = await getRedis();
    if (r) {
      await r.set(key, value, { EX: ttlSeconds });
      return;
    }
    memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async del(key: string): Promise<void> {
    const r = await getRedis();
    if (r) {
      await r.del(key);
      return;
    }
    memory.delete(key);
  },
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async setJson(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  },
};

export async function closeCache(): Promise<void> {
  if (redisClient && typeof (redisClient as { quit?: () => Promise<void> }).quit === "function") {
    try {
      await (redisClient as { quit: () => Promise<void> }).quit();
    } catch {
      /* ignore */
    }
  }
}
