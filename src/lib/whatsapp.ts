/**
 * إرسال واتساب عبر Meta Cloud API.
 * بدون مفاتيح (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID) تعمل
 * كل الدوال بوضع السجل فقط — لا تفشل أي عملية تشغيلية بسبب غياب الإعداد.
 */

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/** تطبيع رقم مصري: 01xxxxxxxxx → 201xxxxxxxxx (واتساب يحتاج الصيغة الدولية)
 * يقبل الأرقام العربية المشرقية (٠١٢٣) والفارسية (۰۱۲۳) والمسافات والشرطات و+20 و0020 */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
/** تحويل الأرقام العربية المشرقية/الفارسية لأرقام لاتينية قبل أي تنظيف */
export function toAsciiDigits(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  return s;
}
export function normalizePhone(raw: string): string | null {  let s = String(raw ?? "");
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  let d = s.replace(/[^\d]/g, "");
  if (d.startsWith("0020")) d = d.slice(2);
  if (/^201[0-9]{9}$/.test(d)) return d;
  if (/^01[0-9]{9}$/.test(d)) return `2${d}`;
  if (/^1[0-9]{9}$/.test(d)) return `20${d}`;
  return null;
}

export function isWhatsAppLive(): boolean {
  return !!(TOKEN && PHONE_ID);
}

export type SendResult =
  | { ok: true; via: "cloud"; messageId: string }
  | { ok: false; via: "disabled"; reason: string };

/** إرسال رسالة نصية حرة (تعمل داخل نافذة 24 ساعة من آخر رسالة للطالب) */
export async function sendWhatsAppText(to: string, body: string): Promise<SendResult> {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, via: "disabled", reason: "bad_phone" };
  if (!isWhatsAppLive()) {
    console.log(`[whatsapp:disabled] to=${phone} body=${body.slice(0, 80)}`);
    return { ok: false, via: "disabled", reason: "not_configured" };
  }
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: body.slice(0, 4000) },
      }),
    });
    const j = await r.json().catch(() => null);
    const mid = j?.messages?.[0]?.id;
    if (!r.ok || !mid) {
      console.error("[whatsapp] send failed:", JSON.stringify(j)?.slice(0, 300));
      return { ok: false, via: "disabled", reason: "send_failed" };
    }
    return { ok: true, via: "cloud", messageId: mid };
  } catch (e: any) {
    console.error("[whatsapp] network error:", e?.message);
    return { ok: false, via: "disabled", reason: "network" };
  }
}

/** إرسال رمز التحقق — النص ثابت لتفادي تصنيفه كتسويق */
export async function sendOtpCode(to: string, code: string, centerName: string): Promise<SendResult> {
  return sendWhatsAppText(
    to,
    `رمز التحقق الخاص بك في ${centerName}: ${code}\nصالح لمدة 10 دقائق — لا تشاركه مع أحد.`
  );
}

/** هل يُسمح بإرجاع الرمز في رد الـ API؟ (تطوير/اختبار فقط — ممنوع في الإنتاج) */
export function otpPassthroughAllowed(): boolean {
  return process.env.OTP_DEV_PASSTHROUGH === "true" && process.env.NODE_ENV !== "production";
}
