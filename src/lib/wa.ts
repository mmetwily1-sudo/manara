/** روابط واتساب الجاهزة — قناة التسجيل والدعم حتى ربط قاعدة البيانات */
export const SUPPORT_WA =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "201025183569";

export function waLink(text: string): string {
  return `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(text)}`;
}

/** رابط واتساب لرقم طالب/ولي أمر مع نص جاهز (تذكير مصروفات/حضور) */
export function waTo(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("01") && d.length === 11) d = "2" + d;
  if (d.length < 10) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export const WA_TRIAL_TEXT = "أهلاً 👋 عايز أفعل تجربتي المجانية (14 يوم)";
