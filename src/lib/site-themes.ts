/**
 * ثيمات موقع السنتر العام — 6 presets + لون أساسي مخصص.
 * المصدر الوحيد للحقيقة (يستهلكها /[teacher] وقسم التصميم).
 */

export type SiteThemeId = "default" | "dark" | "minimal" | "emerald" | "royal" | "sunset";

export const SITE_THEMES: Record<SiteThemeId, { label: string; swatch: string; main: string; header: string; card: string; primary: string }> = {
  default: { label: "افتراضي", swatch: "#1A73E8", primary: "#1A73E8", main: "min-h-screen bg-gradient-to-b from-primary-light/30 to-bg", header: "bg-white/80 backdrop-blur", card: "card" },
  dark: { label: "داكن 🌙", swatch: "#0f172a", primary: "#38bdf8", main: "min-h-screen bg-slate-950 text-slate-100", header: "bg-slate-900/90 backdrop-blur", card: "rounded-xl border border-slate-800 bg-slate-900 p-5" },
  minimal: { label: "بسيط", swatch: "#ffffff", primary: "#1A73E8", main: "min-h-screen bg-white", header: "bg-white border-b border-slate-200", card: "rounded-xl border border-slate-200 p-5" },
  emerald: { label: "زمردي 💚", swatch: "#059669", primary: "#059669", main: "min-h-screen bg-gradient-to-b from-emerald-50 to-bg", header: "bg-white/80 backdrop-blur", card: "card" },
  royal: { label: "ملكي 💜", swatch: "#7c3aed", primary: "#7c3aed", main: "min-h-screen bg-gradient-to-b from-violet-50 to-bg", header: "bg-white/80 backdrop-blur", card: "card" },
  sunset: { label: "غروب 🧡", swatch: "#ea580c", primary: "#ea580c", main: "min-h-screen bg-gradient-to-b from-orange-50 to-bg", header: "bg-white/80 backdrop-blur", card: "card" },
};

export function resolveTheme(id?: string | null): { id: SiteThemeId; def: (typeof SITE_THEMES)[SiteThemeId] } {
  const key = (id ?? "default") as SiteThemeId;
  if (SITE_THEMES[key]) return { id: key, def: SITE_THEMES[key] };
  return { id: "default", def: SITE_THEMES.default };
}
