function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

async function getRedisClient() {
  const { getRedis } = await import("./redis");
  return getRedis();
}

/**
 * @param limit عدد المحاولات المسموحة
 * @param windowMs نافذة الحد (افتراضي ساعة)
 * @param scope نطاق إضافي (مثل tenantId) — يمنع معاقبة شبكة كاملة بسبب مستخدم واحد
 * @returns true إذا تجاوز الحد (يجب الرد 429)
 */
export async function isRateLimited(
  req: Request,
  key: string,
  limit: number,
  windowMs = 60 * 60 * 1000,
  scope?: string | null
): Promise<boolean> {
  const redis = await getRedisClient();
  const mapKey = `rl:${key}:${scope ?? clientIp(req)}`;
  const windowSec = Math.ceil(windowMs / 1000);
  const count = await redis.incr(mapKey);
  if (count === 1) await redis.expire(mapKey, windowSec);
  return count > limit;
}

/**
 * نسخة PIN login — نافذة قصيرة (15 دقيقة) + حد صارم (5 محاولات)
 * تستخدم slug:phone:ip كمفتاح (قبل معرفة studentId)
 */
export async function pinLoginRateOk(
  req: Request,
  slug: string,
  phone: string
): Promise<boolean> {
  const redis = await getRedisClient();
  const ip = clientIp(req);
  const mapKey = `rl:pin-login:${slug}:${phone}:${ip}`;
  const count = await redis.incr(mapKey);
  if (count === 1) await redis.expire(mapKey, 15 * 60);
  return count <= 5;
}

/**
 * نسخة PIN login بعد معرفة الطالب — تستخدم tenantId:studentId:ip
 */
export async function pinRateOk(
  req: Request,
  tenantId: string,
  studentId: string
): Promise<boolean> {
  const redis = await getRedisClient();
  const ip = clientIp(req);
  const mapKey = `rl:pin:${tenantId}:${studentId}:${ip}`;
  const count = await redis.incr(mapKey);
  if (count === 1) await redis.expire(mapKey, 15 * 60);
  return count <= 5;
}