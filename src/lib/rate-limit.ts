/**
 * حد معدل بسيط داخل الذاكرة للنقاط المفتوحة (trial / تسجيل الطلاب).
 * يمنع إغراق إنشاء السناتر والحسابات من IP واحد.
 * ملاحظة: يعمل لكل instance — كافٍ كخط دفاع أول بجانب Supabase Auth rate limits.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * @param limit عدد المحاولات المسموحة
 * @param windowMs نافذة الحد (افتراضي ساعة)
 * @returns true إذا تجاوز الحد (يجب الرد 429)
 */
export function isRateLimited(req: Request, key: string, limit: number, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const mapKey = `${key}:${clientIp(req)}`;
  const b = buckets.get(mapKey);
  if (!b || now >= b.resetAt) {
    buckets.set(mapKey, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  // تنظيف دوري لتفادي نمو الخريطة بلا حدود
  if (buckets.size > 5000 && Math.random() < 0.01) {
    buckets.forEach((v, k) => { if (now >= v.resetAt) buckets.delete(k); });
  }
  return b.count > limit;
}
