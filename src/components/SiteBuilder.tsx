"use client";

import { useEffect, useState } from "react";
import { SECTION_TYPES, type SiteSection, type SectionType } from "@/lib/site-sections";

/** page-builder السنتر: أقسام جاهزة + تحرير + ترتيب + CSS/JS مخصص */
export function SiteBuilder({ slug }: { slug: string }) {
  const [sections, setSections] = useState<SiteSection[]>([]);
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/settings").then(async (r) => {
      const j = await r.json().catch(() => null);
      const s = j?.settings ?? j ?? {};
      if (Array.isArray(s.site_sections)) setSections(s.site_sections);
      if (typeof s.site_custom_css === "string") setCss(s.site_custom_css);
      if (typeof s.site_custom_js === "string") setJs(s.site_custom_js);
    }).catch(() => {});
  }, []);

  async function persist(next: SiteSection[], ncss = css, njs = js) {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/tenant/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_sections: next, site_custom_css: ncss, site_custom_js: njs }),
      });
      const j = await r.json().catch(() => null);
      setMsg(r.ok ? "تم الحفظ ✅" : (j?.message ?? "فشل الحفظ"));
      if (r.ok) { setSections(next); setCss(ncss); setJs(njs); }
    } catch { setMsg("تعذر الاتصال"); }
    setSaving(false);
  }

  function add(type: SectionType) {
    const blank: Record<SectionType, Record<string, unknown>> = {
      announcement: { text: "خصم 20% للحجز المبكر 🎉" },
      hero_custom: { title: "عنوان رئيسي", subtitle: "وصف مختصر", cta_text: "احجز الآن", cta_url: "" },
      features: { items: [{ icon: "🎬", title: "ميزة", desc: "وصف" }] },
      countdown: { label: "ينطلق قريباً", target: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16) },
      text: { title: "عنوان", body: "نص..." },
      cta: { title: "جاهز تبدأ؟", button: "سجل الآن", url: "" },
      testimonials: { items: [{ name: "ولي أمر", text: "رأي..." }] },
      faq: { items: [{ q: "سؤال؟", a: "جواب." }] },
      gallery: { images: [] },
      stats: { items: [{ num: 500, label: "طالب", suffix: "+" }] },
      custom_html: { html: "<p>محتوى مخصص</p>" },
    };
    const s: SiteSection = { id: Math.random().toString(36).slice(2, 10), type, visible: true, data: blank[type] };
    const next = [...sections, s];
    setSections(next);
    persist(next);
    setShowAdd(false);
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
    persist(next);
  }

  function del(i: number) {
    if (!confirm("حذف هذا القسم؟")) return;
    const next = sections.filter((_, k) => k !== i);
    setSections(next);
    persist(next);
  }

  function toggle(i: number) {
    const next = sections.map((s, k) => (k === i ? { ...s, visible: s.visible !== false ? false : true } : s));
    setSections(next);
    persist(next);
  }

  function edit(i: number, data: Record<string, unknown>) {
    const next = sections.map((s, k) => (k === i ? { ...s, data } : s));
    setSections(next);
  }

  function saveEdits() {
    persist(sections);
  }

  const tname = (t: SectionType) => SECTION_TYPES.find((x) => x.id === t)?.label ?? t;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowAdd((v) => !v)} className="btn-primary !px-5 !py-2 text-small">＋ إضافة قسم</button>
        <button onClick={() => setShowCode((v) => !v)} className="btn-secondary !px-5 !py-2 text-small">🧩 كود مخصص CSS/JS</button>
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-5 !py-2 text-small">👁️ معاينة</a>
      </div>
      {msg && <p className="text-xs font-bold text-primary">{msg}</p>}

      {showAdd && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SECTION_TYPES.map((t) => (
            <button key={t.id} onClick={() => add(t.id)} disabled={saving}
              className="rounded-xl border-2 border-slate-200 p-3 text-right transition hover:border-primary disabled:opacity-50">
              <div className="text-small font-bold">{t.label}</div>
              <div className="text-[11px] text-slate-400">{t.desc}</div>
            </button>
          ))}
        </div>
      )}

      {showCode && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500">CSS مخصص (يُمنع @import والروابط الخارجية)</p>
          <textarea value={css} onChange={(e) => setCss(e.target.value)} rows={4} dir="ltr"
            placeholder=".my-class { color: red; }"
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-primary" />
          <p className="text-xs font-bold text-slate-500">JS مخصص (يُحظر عند قفل المالك)</p>
          <textarea value={js} onChange={(e) => setJs(e.target.value)} rows={4} dir="ltr"
            placeholder="console.log('hi')"
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-primary" />
          <button onClick={() => persist(sections)} disabled={saving} className="btn-primary !px-5 !py-2 text-small disabled:opacity-50">
            {saving ? "جاري..." : "حفظ الكود"}
          </button>
        </div>
      )}

      {sections.length === 0 && (
        <p className="rounded-xl bg-slate-50 p-4 text-center text-small text-slate-400">لا أقسام بعد — أضف بنراً أو عدّاداً أو آراء من الأعلى 👆</p>
      )}

      {sections.map((s, i) => (
        <div key={s.id} className="space-y-2 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-small font-bold">{tname(s.type)} {s.visible === false && <span className="text-slate-400">(مخفي)</span>}</span>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">↑</button>
              <button onClick={() => move(i, 1)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">↓</button>
              <button onClick={() => toggle(i)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{s.visible === false ? "إظهار" : "إخفاء"}</button>
              <button onClick={() => del(i)} className="rounded-lg bg-danger/10 px-2 py-1 text-xs font-bold text-danger">حذف</button>
            </div>
          </div>
          <SectionEditor section={s} onChange={(d) => edit(i, d)} />
          <button onClick={saveEdits} disabled={saving} className="btn-secondary !px-4 !py-1.5 text-xs disabled:opacity-50">
            {saving ? "جاري..." : "حفظ القسم"}
          </button>
        </div>
      ))}
    </div>
  );
}

/** محرر حقول بسيط حسب النوع (نصوص + عناصر سطرية بصيغة a | b) */
function SectionEditor({ section, onChange }: { section: SiteSection; onChange: (d: Record<string, unknown>) => void }) {
  const d = section.data as any;
  const set = (k: string, v: unknown) => onChange({ ...d, [k]: v });
  const inp = "w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-small outline-none focus:border-primary";
  const lines = (v: unknown): string => Array.isArray(v) ? v.map((it: any) => typeof it === "string" ? it : Object.values(it ?? {}).join(" | ")).join("\n") : "";
  const parse = (t: string, keys: string[]) => t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const parts = l.split("|").map((x) => x.trim());
    const o: Record<string, string> = {};
    keys.forEach((k, i) => { o[k] = parts[i] ?? ""; });
    return o;
  });

  switch (section.type) {
    case "announcement":
      return <input value={d.text ?? ""} onChange={(e) => set("text", e.target.value)} placeholder="نص الشريط" className={inp} />;
    case "hero_custom":
      return (<div className="space-y-2">
        <input value={d.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="العنوان" className={inp} />
        <input value={d.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} placeholder="الوصف" className={inp} />
        <div className="flex gap-2">
          <input value={d.cta_text ?? ""} onChange={(e) => set("cta_text", e.target.value)} placeholder="نص الزر" className={inp} />
          <input value={d.cta_url ?? ""} onChange={(e) => set("cta_url", e.target.value)} placeholder="رابط الزر" dir="ltr" className={inp} />
        </div>
      </div>);
    case "countdown":
      return (<div className="flex gap-2">
        <input value={d.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="العنوان" className={inp} />
        <input value={d.target ?? ""} onChange={(e) => set("target", e.target.value)} placeholder="2026-12-01T18:00" dir="ltr" className={inp} />
      </div>);
    case "text":
      return (<div className="space-y-2">
        <input value={d.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="العنوان" className={inp} />
        <textarea value={d.body ?? ""} onChange={(e) => set("body", e.target.value)} rows={3} placeholder="النص" className={inp} />
      </div>);
    case "cta":
      return (<div className="space-y-2">
        <input value={d.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="العنوان" className={inp} />
        <div className="flex gap-2">
          <input value={d.button ?? ""} onChange={(e) => set("button", e.target.value)} placeholder="نص الزر" className={inp} />
          <input value={d.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="الرابط" dir="ltr" className={inp} />
        </div>
      </div>);
    case "features":
      return <textarea defaultValue={lines(d.items)} rows={3} placeholder={"🎬 | عنوان | وصف\n📝 | عنوان | وصف"} className={inp + " font-mono"}
        onBlur={(e) => set("items", parse(e.target.value, ["icon", "title", "desc"]))} />;
    case "testimonials":
      return <textarea defaultValue={lines(d.items)} rows={3} placeholder={"الاسم | الرأي"} className={inp + " font-mono"}
        onBlur={(e) => set("items", parse(e.target.value, ["name", "text"]))} />;
    case "faq":
      return <textarea defaultValue={lines(d.items)} rows={4} placeholder={"السؤال | الجواب"} className={inp + " font-mono"}
        onBlur={(e) => set("items", parse(e.target.value, ["q", "a"]))} />;
    case "gallery":
      return <textarea defaultValue={lines(d.images)} rows={3} placeholder="رابط صورة في كل سطر (https://...)" dir="ltr" className={inp + " font-mono text-left"}
        onBlur={(e) => set("images", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />;
    case "stats":
      return <textarea defaultValue={lines(d.items)} rows={2} placeholder={"500 | طالب | +"} className={inp + " font-mono"}
        onBlur={(e) => set("items", parse(e.target.value, ["num", "label", "suffix"]))} />;
    case "custom_html":
      return <textarea defaultValue={String(d.html ?? "")} rows={4} dir="ltr" placeholder="<p>...</p>"
        className={inp + " font-mono text-left"} onBlur={(e) => set("html", e.target.value)} />;
    default:
      return null;
  }
}
