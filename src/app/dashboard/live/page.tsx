"use client";

import { useEffect, useState } from "react";

type S = { id: string; title: string; group?: string; starts_at: string; join_url: string; provider?: string; room?: string; present?: number };

/** اللايف: جدولة برابط (معلم) + انضمام وتسجيل حضور (طالب) */
export default function LivePage() {
  const [isTeacher, setIsTeacher] = useState(false);
  const [sessions, setSessions] = useState<S[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ title: "", group_id: "", starts_at: "", provider: "jitsi", ext_url: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/live", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setIsTeacher(!!j.isTeacher); setSessions(j.sessions ?? []); }
    } catch {}
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups((j.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/live", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (r.ok) { setForm({ title: "", group_id: "", starts_at: "", provider: "jitsi", ext_url: "" }); load(); }
    else {
      const j = await r.json().catch(() => null);
      setMsg(j?.error === "bad_url" ? "ضع رابط صحيح للزوم/الخارجي." : "تعذر الجدولة.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">جلسات اللايف 🔴</h1>
        <p className="mt-1 text-small text-slate-500">جدولة برابط خارجي + تسجيل حضور</p>
      </header>
      {msg && <div className="card p-3 text-small font-bold text-danger">{msg}</div>}
      {isTeacher && (
        <form onSubmit={create} className="card grid gap-2 p-5 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان الجلسة" required maxLength={150}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="">كل المجموعات</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} type="datetime-local" required
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="jitsi">🎥 غرفة المنصة (فوري)</option>
            <option value="zoom">🔵 زوم (رابطك)</option>
            <option value="link">🔗 رابط خارجي</option>
          </select>
          {form.provider !== "jitsi" && (
            <input value={form.ext_url} onChange={(e) => setForm({ ...form, ext_url: e.target.value })} placeholder="رابط الزوم/الخارجي https://..." required maxLength={500} dir="ltr"
              className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          )}
          <button className="btn-primary !py-2 text-small">جدولة الجلسة</button>
        </form>
      )}
      <section className="card space-y-2 p-5">
        <h2 className="font-bold">الجلسات القادمة</h2>
        {sessions.length === 0 ? <div className="text-small text-slate-400">لا جلسات مجدولة.</div> :
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span><b>{s.title}</b> {s.group && <span className="text-xs text-slate-400">({s.group})</span>}
                  <span className="block text-xs text-slate-500">{new Date(s.starts_at).toLocaleString("ar-EG")}</span></span>
                {isTeacher ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">{s.present ?? 0} حاضر</span>
                    <a href={`/live/${s.id}`} className="rounded-lg bg-danger px-4 py-1.5 text-xs font-bold text-white">الغرفة 🔴</a>
                  </span>
                ) : (
                  <a href={`/live/${s.id}`} className="rounded-lg bg-danger px-4 py-1.5 text-xs font-bold text-white">انضم 🔴</a>
                )}
              </li>
            ))}
          </ul>}
      </section>
    </div>
  );
}
