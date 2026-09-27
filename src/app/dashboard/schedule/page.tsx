"use client";

import { useEffect, useState } from "react";

type Slot = { group: string; weekday: number; start: string; end: string; branch: string; teacher: string };
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** الجدول الأسبوعي + تعارضات + حصة تعويضية */
export default function SchedulePage() {
  const [byDay, setByDay] = useState<Record<string, Slot[]>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [mk, setMk] = useState({ groupId: "", date: "", topic: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/schedule");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setByDay(j.byDay ?? {}); setConflicts(j.conflicts ?? []); }
    } catch {}
    try {
      const r = await fetch("/api/groups");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups((j.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function makeup(e: React.FormEvent) {
    e.preventDefault();
    if (!mk.groupId || !mk.date) return;
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: mk.groupId, kind: "makeup", session_date: mk.date, topic: mk.topic }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setNotice(`تمت جدولة الحصة التعويضية ✅ (${mk.date})`); setMk({ groupId: "", date: "", topic: "" }); }
      else setNotice("فشل الجدولة.");
    } catch { setNotice("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-h1">جدول الحصص 🗓️</h1>
        <p className="mt-1 text-small text-slate-500">مواعيد كل المجموعات — والتعارضات تُكشف تلقائياً</p>
      </header>

      {conflicts.length > 0 && (
        <section className="card space-y-1 border-danger/25 bg-danger/5 p-5">
          <h2 className="font-bold text-danger">تعارضات ({conflicts.length}) ⚠️</h2>
          {conflicts.map((c, i) => <div key={i} className="text-small text-slate-600">• {c}</div>)}
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-7 md:grid-cols-2">
        {DAYS.map((d, i) => (
          <div key={i} className="card min-h-32 p-3">
            <div className="mb-2 text-small font-bold">{d}</div>
            <div className="space-y-1.5">
              {((byDay as any)[i] ?? []).map((s: Slot, j: number) => (
                <div key={j} className="rounded-lg bg-primary-light/60 px-2 py-1.5 text-[11px]">
                  <div className="font-bold text-primary" dir="ltr">{s.start}–{s.end}</div>
                  <div className="font-bold">{s.group}</div>
                  <div className="text-slate-500">{s.teacher} · {s.branch}</div>
                </div>
              ))}
              {((byDay as any)[i] ?? []).length === 0 && <div className="text-[11px] text-slate-300">—</div>}
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">حصة تعويضية 🔁</h2>
        {notice && <div className="text-small font-bold text-primary">{notice}</div>}
        <form onSubmit={makeup} className="grid gap-2 sm:grid-cols-4">
          <select value={mk.groupId} onChange={(e) => setMk({ ...mk, groupId: e.target.value })} required className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
            <option value="">المجموعة…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input value={mk.date} onChange={(e) => setMk({ ...mk, date: e.target.value })} required type="date" className="rounded-xl border border-slate-200 px-4 py-2.5 text-small" />
          <input value={mk.topic} onChange={(e) => setMk({ ...mk, topic: e.target.value })} maxLength={100} placeholder="الموضوع (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 text-small sm:col-span-1" />
          <button className="btn-primary !py-2.5 text-small" disabled={busy}>{busy ? "جاري..." : "جدولة التعويضية"}</button>
        </form>
      </section>
    </div>
  );
}
