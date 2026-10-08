// Dynamic require to avoid bundling ioredis at build time
let redis: any = null;
let Redis: any = null;

function loadRedis() {
  if (Redis) return Redis;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Redis = require("ioredis");
  return Redis;
}

export async function getRedis(): Promise<any> {
  if (redis) return redis;
  const url = process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL;
  if (!url) {
    // بدون Redis: fallback in-memory. يعمل لكل البيئات (dev + production).
    // ملاحظة: في الإنتاج متعدد النسخ (Vercel) يكون الحد per-instance لا مركزياً —
    // حماية كافية للحجم الحالي، وأفضل من رمي 500. أضف REDIS_URL لاحقاً لحد مركزي صارم.
    console.warn("[redis] REDIS_URL not set — in-memory rate limiting (per-instance)");
    return new MapRedis();
  }
  const RedisClass = loadRedis();
  redis = new RedisClass.default(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 100, 2000)),
    lazyConnect: true,
  });
  redis.on("error", (e: any) => console.error("[redis] error", e?.message ?? e));
  return redis;
}

export async function ensureRedisConnected(): Promise<any> {
  const r = await getRedis();
  if (r instanceof MapRedis) return r;
  if (r.status === "wait") await r.connect();
  return r;
}

// Minimal Redis-compatible interface for dev fallback
class MapRedis {
  private store = new Map<string, { val: number; exp?: NodeJS.Timeout }>();
  status = "ready";
  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const val = (entry?.val ?? 0) + 1;
    this.store.set(key, { val });
    return val;
  }
  async expire(key: string, sec: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.exp) clearTimeout(entry.exp);
    entry.exp = setTimeout(() => this.store.delete(key), sec * 1000);
    return 1;
  }
  on() {} // no-op for compatibility
}