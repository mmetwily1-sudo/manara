/**
 * Cloudflare Turnstile للنماذج العامة (trial / تسجيل الطلاب).
 * بدون مفاتيح (TURNSTILE_SECRET_KEY) يُتجاوز التحقق تلقائياً (وضع التطوير) —
 * على الإنتاج اربط المفاتيح من لوحة Cloudflare (مجاني) ثم أضفهما في Vercel.
 */

export function captchaRequired(): boolean {
  return !!(process.env.TURNSTILE_SECRET_KEY ?? "").trim();
}

export function captchaSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
}

/** يتحقق من توكن Turnstile — true تعني مقبول (أو غير مطلوب أصلاً) */
export async function verifyCaptcha(token: unknown, ip?: string | null): Promise<boolean> {
  const secret = (process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) return true; // غير مُعد — تجاوز (سجّل تحذيراً مرة واحدة)
  const t = String(token ?? "").trim();
  if (!t) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const fd = new FormData();
    fd.set("secret", secret);
    fd.set("response", t);
    if (ip) fd.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: fd, signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const j = await r.json().catch(() => null);
    return !!(j as any)?.success;
  } catch {
    return false;
  }
}
