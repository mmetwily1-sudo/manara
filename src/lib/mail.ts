/**
 * بريد المنصة عبر Resend — مفتاح واحد للمنصة كلها (3,000 رسالة/شهر مجاناً).
 * يُفعَّل بوضع RESEND_API_KEY في البيئة مرة واحدة — صفر خطوات على العملاء.
 */

const KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.MAIL_FROM ?? "منارة <no-reply@manara.app>";

export function isMailLive(): boolean {
  return KEY.length > 5;
}

export async function sendMail(to: string, subject: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isMailLive()) return { ok: false, reason: "not_configured" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, reason: "bad_email" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: subject.slice(0, 120), text: text.slice(0, 5000) }),
    });
    if (!r.ok) return { ok: false, reason: "send_failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "conn" };
  }
}
