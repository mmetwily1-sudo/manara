"use client";

import { useEffect, useState } from "react";

type Ann = { id: string; group_name: string; body: string; sender: string; created_at: string | null };

export default function AnnouncementsPage() {
  const [list, setList] = useState<Ann[] | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ group_id: "", body: "", publish_at: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  type Ev = { id: string; title: string; event_at: string; fee: number; capacity: number; active: boolean };
  const [events, setEvents] = useState<Ev[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [eform, setEform] = useState({ title: "", event_at: "", fee: "", capacity: "" });

  async function loadEvents() {
    try {
      const r = await fetch("/api/events", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.isTeacher) { setEvents(j.events ?? []); setCounts(j.counts ?? {}); }
    } catch {}
  }
  useEffect(() => { loadEvents(); }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: eform.title, event_at: eform.event_at, fee: Number(eform.fee || 0), capacity: eform.capacity === "" ? -1 : Number(eform.capacity) }),
    });
    if (r.ok) { setEform({ title: "", event_at: "", fee: "", capacity: "" }); loadEvents(); }
  }

  async function load() {
    try {
      const r = await fetch("/api/announcements", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.announcements ?? []);
    } catch {}
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups((j.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: form.group_id || null, body: form.body, publish_at: form.publish_at || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsg(form.publish_at ? "تمت الجدولة ⏰" : "تم النشر 📢"); setForm({ group_id: "", body: "", publish_at: "" }); load(); }
      else setMsg(j?.message ?? "فشل النشر.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">الإعلانات 📢</h1>
        <p className="mt-1 text-small text-slate-500">انشر للسنتر كله أو لمجموعة — تظهر للطلاب فوراً.</p>
      </header>
      {msg && <p className="card p-3 text-small font-bold text-primary">{msg}</p>}
      <form onSubmit={post} className="card space-y-3 p-5">
        <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <option value="">📢 عام — كل السنتر</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={3}
          placeholder="اكتب الإعلان..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <label className="flex items-center gap-2 text-small text-slate-500">
          ⏰ جدولة النشر (اختياري):
          <input value={form.publish_at} onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
            type="datetime-local" className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        </label>
        <button className="btn-primary" disabled={busy}>{busy ? "جاري..." : form.publish_at ? "جدولة الإعلان ⏰" : "نشر الإعلان"}</button>
      </form>
      {list === null ? <div className="card p-8 text-center text-slate-400">جاري التحميل...</div> : (
        <ul className="space-y-3">
          {list.length === 0 && <li className="card p-6 text-center text-small text-slate-500">لا إعلانات بعد.</li>}
          {list.map((a) => (
            <li key={a.id} className="card p-4">
              <div className="text-small leading-relaxed">{a.body}</div>
              <div className="mt-2 text-xs text-slate-400">{a.group_name}{a.created_at ? ` · ${new Date(a.created_at).toLocaleString("ar-EG")}` : ""}</div>
            </li>
          ))}
        </ul>
      )}
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">الفعاليات 🎪</h2>
        <form onSubmit={createEvent} className="grid gap-2 sm:grid-cols-5">
          <input value={eform.title} onChange={(e) => setEform({ ...eform, title: e.target.value })} placeholder="اسم الفعالية" required maxLength={150}
            className="rounded-xl border border-slate-200 px-3 py-2 text-small sm:col-span-2" />
          <input value={eform.event_at} onChange={(e) => setEform({ ...eform, event_at: e.target.value })} type="datetime-local" required
            className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <input value={eform.fee} onChange={(e) => setEform({ ...eform, fee: e.target.value })} placeholder="الرسوم (0=مجاناً)" inputMode="decimal" dir="ltr"
            className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <input value={eform.capacity} onChange={(e) => setEform({ ...eform, capacity: e.target.value })} placeholder="السعة (فارغ=مفتوحة)" inputMode="numeric" dir="ltr"
            className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <button className="btn-primary !py-2 text-small sm:col-span-5">إضافة فعالية</button>
        </form>
        {events.length > 0 && (
          <ul className="space-y-2">
            {events.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span><b>{v.title}</b> — {new Date(v.event_at).toLocaleString("ar-EG")} · {v.fee > 0 ? `${v.fee} ج` : "مجاناً"} · {counts[v.id] ?? 0} مسجل</span>
                <span className={`text-xs font-bold ${v.active ? "text-success" : "text-slate-400"}`}>{v.active ? "نشطة" : "موقوفة"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
