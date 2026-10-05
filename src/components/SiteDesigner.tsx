"use client";

import { useEffect, useState } from "react";
import { SITE_THEMES, type SiteThemeId } from "@/lib/site-themes";

/**
 * قسم "تصميم الموقع" في إعدادات السنتر: ثيم + لون أساسي + معاينة حية.
 * يحفظ في settings (theme, site_primary) — يستهلكها /[slug] فوراً.
 */
export function SiteDesigner({ slug }: { slug: string }) {
  const [theme, setTheme] = useState<SiteThemeId>("default");
  const [primary, setPrimary] = useState("");
  const [font, setFont] = useState("cairo");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/tenant/settings").then(async (r) => {
      const j = await r.json().catch(() => null);
      const s = j?.settings ?? j ?? {};
      if (s.theme && SITE_THEMES[s.theme as SiteThemeId]) setTheme(s.theme);
      if (s.site_primary) setPrimary(s.site_primary);
      if (["cairo", "readex", "plex"].includes(s.site_font)) setFont(s.site_font);
    }).catch(() => {});
  }, []);

  async function save(patch: Record<string, string>) {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/tenant/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => null);
      setMsg(r.ok ? "تم الحفظ ✅" : (j?.message ?? "فشل الحفظ"));
    } catch { setMsg("تعذر الاتصال"); }
    setSaving(false);
  }

  function pick(t: SiteThemeId) {
    setTheme(t);
    save({ theme: t });
  }

  function saveColor() {
    if (!/^#[0-9a-fA-F]{6}$/.test(primary)) { setMsg("اللون بصيغة #RRGGBB"); return; }
    save({ site_primary: primary });
  }

  function pickFont(f: string) {
    setFont(f);
    save({ site_font: f });
  }

  function resetAll() {
    if (!confirm("إعادة موقعك للثيم الافتراضي؟")) return;
    setTheme("default"); setPrimary(""); setFont("cairo");
    save({ theme: "default", site_primary: "", site_font: "cairo" });
  }

  return (
    <div>
      <h2 className="font-bold">تصميم الموقع 🎨</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        ثيم موقع سنترك العام + لونك الأساسي — التغيير يظهر فوراً لزوارك.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(Object.entries(SITE_THEMES) as [SiteThemeId, (typeof SITE_THEMES)[SiteThemeId]][]).map(([id, t]) => (
          <button key={id} onClick={() => pick(id)} disabled={saving}
            className={`rounded-xl border-2 p-3 text-center transition disabled:opacity-50 ${theme === id ? "border-primary bg-primary-light" : "border-slate-200 hover:border-primary"}`}>
            <span className="mx-auto block h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: t.swatch }} />
            <span className="mt-1 block text-xs font-bold">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input value={primary} onChange={(e) => setPrimary(e.target.value)} dir="ltr" maxLength={7}
          placeholder="#1A73E8"
          className="w-32 rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-small outline-none focus:border-primary" />
        <button onClick={saveColor} disabled={saving} className="btn-secondary !px-4 !py-2 text-small disabled:opacity-50">
          حفظ اللون
        </button>
        {primary && /^#[0-9a-fA-F]{6}$/.test(primary) && (
          <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: primary }} />
        )}
      </div>
      {msg && <p className="mt-1 text-xs font-bold text-primary">{msg}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">الخط:</span>
        {[["cairo", "Cairo"], ["readex", "Readex Pro"], ["plex", "IBM Plex"]].map(([v, l]) => (
          <button key={v} onClick={() => pickFont(v)} disabled={saving}
            className={`rounded-xl border-2 px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${font === v ? "border-primary bg-primary-light text-primary" : "border-slate-200 text-slate-500"}`}>
            {l}
          </button>
        ))}
        <button onClick={resetAll} disabled={saving} className="mr-auto text-xs font-bold text-slate-400 hover:text-danger disabled:opacity-50">
          ↩️ افتراضي
        </button>
      </div>
      <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-small font-bold text-primary">
        👁️ معاينة موقعي
      </a>
    </div>
  );
}
