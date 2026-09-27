"use client";

import { useEffect, useState } from "react";

type B = { id: string; name: string; phone: string; group_id: string | null; kind: string; status: string; note: string; created_at: string; groups: { name: string } | null };

const ST: Record<string, [string, string]> = {
  pending: ["بانتظار ⏳", "bg-warning/10 text-warning"],
  confirmed: ["مؤكد ✅", "bg-success/10 text-success"],
  cancelled: ["ملغي ⛔", "bg-slate-100 text-slate-400"],
  done: ["تم 🎉", "bg-primary-light text-primary"],
};

/** الحجوزات التجريبية + قوائم الانتظار — من صفحة المعلم العامة إلى التأكيد */
export default function BookingsPage() {
  const [list, setList] = useState<B[] | null>(null);
  const [filter, setFilter] = useState("pending");
  const [err, setErr] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/bookings");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.bookings);
      else setErr("تعذر التحميل.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    try {
      const r = await fetch("/api/bookings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (r.ok) load();
    } catch {}
  }

  const shown = (list ?? []).filter((b) => (filter === "all" ? true : b.status === filter));
  const pending = (list ?? []).filter((b) => b.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الحجوزات والقوائم 📅</h1>
          <p className="mt-1 text-small text-slate-500">تجريبي من صفحة المعلم + انتظار المجموعات الممتلئة ({pending} بانتظار)</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          {[["pending", "بانتظار"], ["confirmed", "مؤكدة"], ["done", "تمت"], ["cancelled", "ملغاة"], ["all", "الكل"]].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {list === null ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا حجوزات هنا — شارك رابط صفحتك العامة (/t/...) ليحجز الطلاب.</div>
      ) : (
        <ul className="space-y-2">
          {shown.map((b) => {
            const [label, tone] = ST[b.status] ?? [b.status, "bg-slate-100"];
            return (
              <li key={b.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <span className="font-bold">{b.name}</span>
                  <span className="mx-2 font-mono text-xs text-slate-400" dir="ltr">{b.phone}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
                  <span className="mx-2 text-[11px] text-slate-400">{b.kind === "waitlist" ? "انتظار 📋" : "تجريبي 🎟️"}{b.groups?.name ? ` · ${b.groups.name}` : ""}</span>
                  {b.note && <span className="block text-xs text-slate-400">{b.note}</span>}
                </div>
                {b.status === "pending" && (
                  <div className="flex gap-2">
                    <a href={`https://wa.me/${b.phone}`} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white">واتساب 💬</a>
                    <button onClick={() => setStatus(b.id, "confirmed")} className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary">تأكيد</button>
                    <button onClick={() => setStatus(b.id, "cancelled")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">إلغاء</button>
                  </div>
                )}
                {b.status === "confirmed" && (
                  <button onClick={() => setStatus(b.id, "done")} className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold text-success">تم الحضور 🎉</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
