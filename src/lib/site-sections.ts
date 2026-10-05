/**
 * أقسام موقع السنتر (page-builder): JSON مُتحقق منه في settings.site_sections.
 * أنواع بيضاء فقط + أحجام قصوى + تجريد script من HTML (الـ JS في حقل مستقل).
 */

export type SectionType =
  | "announcement" | "hero_custom" | "features" | "countdown" | "text"
  | "cta" | "testimonials" | "faq" | "gallery" | "custom_html" | "stats";

export type SiteSection = { id: string; type: SectionType; visible?: boolean; data: Record<string, unknown> };

export const SECTION_TYPES: { id: SectionType; label: string; desc: string }[] = [
  { id: "announcement", label: "📢 شريط إعلان", desc: "سطر علوي متحرك للنصوص العاجلة" },
  { id: "hero_custom", label: "🌟 واجهة مخصصة", desc: "عنوان + وصف + زر" },
  { id: "features", label: "✨ مميزات", desc: "3 بطاقات بأيقونات" },
  { id: "countdown", label: "⏳ عدّاد تنازلي", desc: "للانطلاقة أو عرض" },
  { id: "text", label: "📝 نص حر", desc: "عنوان + فقرة" },
  { id: "cta", label: "📣 دعوة تسجيل", desc: "بطاقة بزر رابط" },
  { id: "testimonials", label: "💬 آراء", desc: "3 آراء طلاب/أهالي" },
  { id: "faq", label: "❓ أسئلة شائعة", desc: "حتى 6 أسئلة" },
  { id: "gallery", label: "🖼️ معرض", desc: "روابط صور" },
  { id: "stats", label: "🏆 إنجازات", desc: "أرقام متحركة (طلاب/نجاح)" },
  { id: "custom_html", label: "🧩 HTML مخصص", desc: "بلا سكربتات (تُزال تلقائياً)" },
];

const STR = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const ARR = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").slice(0, 300)).slice(0, max) : [];

/** تنقية قسم واحد — ترجع null للمرفوض */
export function sanitizeSection(s: any): SiteSection | null {
  if (!s || typeof s !== "object") return null;
  const type = String(s.type ?? "") as SectionType;
  if (!SECTION_TYPES.some((t) => t.id === type)) return null;
  const d = (s.data ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const put = (k: string, v: unknown, max = 500) => { out[k] = STR(v, max); };
  switch (type) {
    case "announcement": put("text", d.text, 200); break;
    case "hero_custom": put("title", d.title, 120); put("subtitle", d.subtitle, 300); put("cta_text", d.cta_text, 40); put("cta_url", d.cta_url, 300); break;
    case "features": {
      const items = Array.isArray(d.items) ? d.items.slice(0, 6).map((it: any) => ({ icon: STR(it?.icon, 8), title: STR(it?.title, 60), desc: STR(it?.desc, 200) })) : [];
      out.items = items; break;
    }
    case "countdown": put("label", d.label, 120); put("target", d.target, 30); break;
    case "text": put("title", d.title, 120); put("body", d.body, 2000); break;
    case "cta": put("title", d.title, 120); put("button", d.button, 40); put("url", d.url, 300); break;
    case "testimonials": {
      const items = Array.isArray(d.items) ? d.items.slice(0, 6).map((it: any) => ({ name: STR(it?.name, 60), text: STR(it?.text, 300) })) : [];
      out.items = items; break;
    }
    case "faq": {
      const items = Array.isArray(d.items) ? d.items.slice(0, 8).map((it: any) => ({ q: STR(it?.q, 200), a: STR(it?.a, 500) })) : [];
      out.items = items; break;
    }
    case "gallery": out.images = ARR(d.images, 8).filter((x) => /^https:\/\//.test(x)); break;
    case "stats": {
      const items = Array.isArray(d.items) ? d.items.slice(0, 4).map((it: any) => ({ num: Math.min(999999, Math.max(0, parseInt(String(it?.num ?? "0"), 10) || 0)), label: STR(it?.label, 40), suffix: STR(it?.suffix, 8) })) : [];
      out.items = items; break;
    }
    case "custom_html": {
      let html = STR(d.html, 5000);
      html = html.replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/\son\w+\s*=/gi, " data-x=");
      out.html = html; break;
    }
  }
  return { id: STR(s.id, 24) || Math.random().toString(36).slice(2, 10), type, visible: s.visible !== false, data: out };
}

/** تنقية قائمة كاملة (20 قسماً كحد أقصى، 30KB) */
export function sanitizeSections(list: unknown): SiteSection[] {
  if (!Array.isArray(list)) return [];
  const out: SiteSection[] = [];
  for (const s of list.slice(0, 20)) {
    const clean = sanitizeSection(s);
    if (clean) out.push(clean);
  }
  const json = JSON.stringify(out);
  if (json.length > 30000) return out.slice(0, Math.max(1, Math.floor(out.length / 2)));
  return out;
}

/** تنقية CSS مخصص (10KB — نمنع @import وurl خارجي) */
export function sanitizeCss(css: unknown): string {
  let s = STR(css, 10000);
  s = s.replace(/@import[^;]+;/gi, "").replace(/url\s*\(\s*['"]?https?:/gi, "url(#blocked:");
  return s;
}

/** تنقية JS مخصص (10KB — يُحظر عند قفل المالك) */
export function sanitizeJs(js: unknown): string {
  return STR(js, 10000);
}
