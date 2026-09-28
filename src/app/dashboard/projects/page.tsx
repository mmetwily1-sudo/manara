"use client";

import { useEffect, useState } from "react";

type P = { id: string; student: string; title: string; description: string; link: string; status: string; featured: boolean };

const STATUS: Record<string, string> = { pending: "قيد المراجعة ⏳", approved: "معتمد ✅", rejected: "مرفوض" };

/** مشاريع الطلاب: تقديم (طالب) + اعتماد وتمييز (معلم) */
export default function ProjectsPage() {
  const [isTeacher, setIsTeacher] = useState(false);
  const [rows, setRows] = useState<P[]>([]);
  const [form, setForm] = useState({ title: "", description: "", link: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/projects", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setIsTeacher(!!j.isTeacher); setRows(j.rows ?? []); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setForm({ title: "", description: "", link: "" }); setMsg("تم التقديم ✅"); load(); }
    else setMsg(j?.error === "bad_link" ? "الرابط يجب أن يبدأ بـ http." : "فشل التقديم.");
  }

  async function review(id: string, patch: any) {
    const r = await fetch("/api/projects", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }),
    });
    if (r.ok) load();
  }

  const featured = rows.filter((p) => p.featured && p.status === "approved");
  const rest = rows.filter((p) => !(p.featured && p.status === "approved"));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">مشاريع الطلاب 🚀</h1>
        <p className="mt-1 text-small text-slate-500">اعرض شغلك — والأفضل يُميز</p>
      </header>
      {msg && <div className="card p-3 text-small font-bold text-primary">{msg}</div>}
      {!isTeacher && (
        <form onSubmit={submit} className="card grid gap-2 p-5 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اسم المشروع" required maxLength={150}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="الوصف..." rows={2} maxLength={2000}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="رابط (اختياري) https://..." dir="ltr" maxLength={500}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          <button className="btn-primary !py-2 text-small sm:col-span-2">تقديم المشروع</button>
        </form>
      )}
      {featured.length > 0 && (
        <section className="card space-y-2 border-warning/30 p-5">
          <h2 className="font-bold">مشاريع مميزة ⭐</h2>
          {featured.map((p) => (
            <div key={p.id} className="rounded-xl bg-warning/5 px-4 py-2.5 text-small">
              <b>{p.title}</b> <span className="text-xs text-slate-400">— {p.student}</span>
              {p.description && <div dir="auto" className="mt-1">{p.description}</div>}
              {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary">الرابط 🔗</a>}
            </div>
          ))}
        </section>
      )}
      <section className="card space-y-2 p-5">
        <h2 className="font-bold">{isTeacher ? "المراجعة" : "مشاريعي"}</h2>
        {rest.length === 0 ? <div className="text-small text-slate-400">لا عناصر.</div> :
          <ul className="space-y-2">
            {rest.map((p) => (
              <li key={p.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><b>{p.title}</b> {isTeacher && <span className="text-xs text-slate-400">— {p.student}</span>}</span>
                  <span className="text-xs font-bold text-slate-500">{STATUS[p.status] ?? p.status}</span>
                </div>
                {p.description && <div dir="auto" className="mt-1 text-slate-600">{p.description}</div>}
                {isTeacher && p.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => review(p.id, { status: "approved" })} className="rounded-lg bg-success px-3 py-1 text-xs font-bold text-white">اعتماد</button>
                    <button onClick={() => review(p.id, { status: "rejected" })} className="rounded-lg bg-danger/10 px-3 py-1 text-xs font-bold text-danger">رفض</button>
                  </div>
                )}
                {isTeacher && p.status === "approved" && (
                  <button onClick={() => review(p.id, { featured: !p.featured })} className="mt-2 text-xs font-bold text-warning">
                    {p.featured ? "إلغاء التمييز" : "تمييز ⭐"}
                  </button>
                )}
              </li>
            ))}
          </ul>}
      </section>
    </div>
  );
}
