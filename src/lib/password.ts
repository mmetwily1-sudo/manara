/**
 * سياسة كلمات السر: 8 أحرف على الأقل + حرف + رقم.
 * تُطبق خادمياً في كل مسارات إنشاء/تعيين كلمة السر.
 */

/** null = صالحة، وإلا رسالة عربية للسبب */
export function checkPassword(pw: unknown): string | null {
  const s = String(pw ?? "");
  if (s.length < 8) return "كلمة السر قصيرة — 8 أحرف على الأقل.";
  if (!/[A-Za-z\u0600-\u06FF]/.test(s)) return "كلمة السر يجب أن تحتوي حرفاً على الأقل.";
  if (!/\d/.test(s)) return "كلمة السر يجب أن تحتوي رقماً على الأقل.";
  if (s.length > 128) return "كلمة السر طويلة جداً.";
  return null;
}

/** كود الخطأ الموحد لمسارات API */
export const WEAK_PASSWORD = "weak_password";
