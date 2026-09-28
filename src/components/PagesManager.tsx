"use client";

import { useEffect, useState } from "react";

type P = { id: string; slug: string; title: string; body: string; published: boolean };

/** صفحات السنتر المخصصة: إنشاء + نشر + رابط عام */
export function PagesManager() {
  const [pages, setPages] = useState<P[] | null>(null);
  const [slug, setSlug] = useState("");
  const [form, setForm] = useState({ title: "", body: "", slug: "" });
  const [edit, setEdit] = useState("");
  const [tenant, setTenant] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/pages", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setPages(j.pages ?? []); setTenant(j.tenant_slug ?? ""); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/pages", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (r.ok) { setForm({ title: "", body: "", slug: "" }); load(); }
    else setSlug("تحقق من الرابط (حروف إنجليزية صغيرة وشرطات).");
  }

  async function save(p: P) {
    const r = await fetch("/api/pages", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, title: p.title, body: p.body, published: p.published }),
    });
    if (r.ok) { setEdit(""); load(); }
  }

  async function toggle(p: P) {
    const r = await fetch("/api/pages", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, published: !p.published }),
    });
    if (r.ok) load();
  }

  async function remove(id: string) {
    if (!confirm("حذف الصفحة؟")) return;
    const r = await fetch(`/api/pages?id=${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  if (pages === null) return null;
  return (
    <div>
      <h2 className="font-bold">صفحات مخصصة 📄</h2>
      {slug && <div className="mt-1 text-xs font-bold text-danger">{slug}</div>}
      <form onSubmit={create} className="mt-3 grid gap-2 sm:grid-cols-3">
        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="الرابط about-us" required dir="ltr"
          className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-small" />
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="العنوان" required maxLength={150}
          className="rounded-xl border border-slate-200 px-3 py-2 text-small sm:col-span-2" />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="المحتوى..." rows={2} maxLength={20000}
          className="rounded-xl border border-slate-200 px-3 py-2 text-small sm:col-span-3" />
        <button className="btn-primary !py-2 text-small sm:col-span-3">إنشاء صفحة</button>
      </form>
      {pages.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pages.map((p) => (
            <li key={p.id} className="rounded-xl bg-slate-50 p-3 text-small">
              {edit === p.id ? (
                <div className="space-y-2">
                  <input value={p.title} onChange={(e) => setPages(pages.map((x) => x.id === p.id ? { ...x, title: e.target.value } : x))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5" />
                  <textarea value={p.body} onChange={(e) => setPages(pages.map((x) => x.id === p.id ? { ...x, body: e.target.value } : x))} rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5" />
                  <div className="flex gap-2">
                    <button onClick={() => save(p)} className="rounded-lg bg-success px-3 py-1 text-xs font-bold text-white">حفظ</button>
                    <button onClick={() => { setEdit(""); load(); }} className="text-xs text-slate-400">إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><b>{p.title}</b> <code dir="ltr" className="text-xs text-slate-400">/{p.slug}</code>
                    {p.published && tenant && <a href={`/p/${tenant}/${p.slug}`} target="_blank" rel="noreferrer" className="mr-2 text-xs font-bold text-primary">عرض 🌐</a>}</span>
                  <span className="flex gap-2">
                    <button onClick={() => setEdit(p.id)} className="text-xs font-bold text-primary">تعديل</button>
                    <button onClick={() => toggle(p)} className={`text-xs font-bold ${p.published ? "text-warning" : "text-success"}`}>
                      {p.published ? "إخفاء" : "نشر"}
                    </button>
                    <button onClick={() => remove(p.id)} className="text-xs font-bold text-danger">حذف</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
