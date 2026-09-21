/** روابط واتساب الجاهزة — قناة التسجيل والدعم حتى ربط قاعدة البيانات */
export const SUPPORT_WA =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "201025183569";

export function waLink(text: string): string {
  return `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(text)}`;
}

export const WA_TRIAL_TEXT = "أهلاً 👋 عايز أفعل تجربتي المجانية (14 يوم)";
