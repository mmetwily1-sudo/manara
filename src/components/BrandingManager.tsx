"use client";

import { useEffect, useState } from "react";

/** هوية السنتر: شعار + لون (تظهر في بوابة ولي الأمر) */
export function BrandingManager() {
  const [form, setForm] = useState({ name: "", logo_url: "", primary_color: "#1A73E8" });
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/tenant/branding", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ name: j.branding?.name ?? "", logo_url: j.branding?.logo_url ?? "", primary_color: j.branding?.primary_color ?? "#1A73E8" });
        setReady(true);
      }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/tenant/branding", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo_url: form.logo_url, primary_color: form.primary_color }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) setMsg("تم الحفظ ✅");
    else setMsg(j?.error === "bad_logo" ? "رابط الشعار غير صالح (png/jpg/webp)." : j?.error === "bad_color" ? "اللون بصيغة #RRGGBB." : "فشل الحفظ.");
  }

  if (!ready) return null;

  return (
    <div>
      <h2 className="font-bold">هوية السنتر 🎨</h2>
      <form onSubmit={save} className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          {form.logo_url ? <img src={form.logo_url} alt={form.name} className="h-12 w-12 rounded-xl object-cover" /> : <span className="text-xs text-slate-400">بلا شعار</span>}
          <span className="font-bold" style={{ color: form.primary_color }}>{form.name}</span>
        </div>
        <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="رابط الشعار https://..." dir="ltr"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-small" />
        <div className="flex items-center gap-2">
          <input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} type="color"
            className="h-10 w-16 cursor-pointer rounded-xl border border-slate-200" dir="ltr" />
          <input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} maxLength={7} dir="ltr"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 font-mono text-small" />
          <button className="btn-primary !py-2 text-small">حفظ</button>
        </div>
      </form>
      {msg && <div className="mt-2 text-xs font-bold text-primary">{msg}</div>}
    </div>
  );
}
