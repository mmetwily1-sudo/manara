"use client";

import { useEffect, useState } from "react";

type Task = { id: string; title: string; assignee_id: string | null; due_date: string | null; status: string; users: { full_name: string } | null };
type Leave = { id: string; from_date: string; to_date: string; reason: string; status: string; users: { full_name: string } | null };
type Perf = { id: string; name: string; role: string; tasksDone: number; tasksOpen: number; attendanceMarked: number; score: number };

/** فريق العمل: مهام + تقييم أداء + إجازات */
export default function TeamPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [perf, setPerf] = useState<Perf[] | null>(null);
  const [comm, setComm] = useState<{ rate: number; rows: { name: string; collected: number; commission: number }[] } | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ title: "", assignee_id: "", due_date: "" });
  const [lv, setLv] = useState({ from_date: "", to_date: "", reason: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [rt, rl, rp, rs] = await Promise.all([
        fetch("/api/team/tasks"), fetch("/api/team/leaves"), fetch("/api/team/performance"), fetch("/api/staff"),
      ]);
      const jt = await rt.json().catch(() => null);
      const jl = await rl.json().catch(() => null);
      const jp = await rp.json().catch(() => null);
      const js = await rs.json().catch(() => null);
      if (rt.ok && jt?.ok) setTasks(jt.tasks);
      if (rl.ok && jl?.ok) { setLeaves(jl.leaves); setIsOwner(jl.isOwner); }
      if (rp.ok && jp?.ok) setPerf(jp.staff);
      try {
        const rc = await fetch("/api/team/commissions");
        const jc = await rc.json().catch(() => null);
        if (rc.ok && jc?.ok) { setComm(jc); setRateDraft(String(jc.rate)); }
      } catch {}
      if (rs.ok && js?.ok) setStaff((js.staff ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/team/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, assignee_id: form.assignee_id || undefined, due_date: form.due_date || undefined }),
      });
      if (r.ok) { setForm({ title: "", assignee_id: "", due_date: "" }); load(); }
    } catch {}
    finally { setBusy(false); }
  }

  async function taskStatus(id: string, status: string) {
    try {
      const r = await fetch("/api/team/tasks", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (r.ok) load();
    } catch {}
  }

  async function addLeave(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/team/leaves", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lv),
      });
      if (r.ok) { setLv({ from_date: "", to_date: "", reason: "" }); load(); }
    } catch {}
    finally { setBusy(false); }
  }

  async function decideLeave(id: string, status: string) {
    try {
      const r = await fetch("/api/team/leaves", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (r.ok) load();
    } catch {}
  }

  const open = (tasks ?? []).filter((t) => t.status === "open");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">فريق العمل 🛠️</h1>
        <p className="mt-1 text-small text-slate-500">مهام وتقييم وإجازات — {open.length} مهمة مفتوحة</p>
      </header>

      {perf && (
        <section className="card space-y-2 p-5">
          <h2 className="font-bold">تقييم الأداء (30 يوماً) ⭐</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perf.map((p, i) => (
              <div key={p.id} className="rounded-xl bg-slate-50 p-4">
                <div className="font-bold">{i === 0 ? "🥇 " : ""}{p.name} <span className="text-xs font-normal text-slate-400">{p.role}</span></div>
                <div className="mt-1 text-xs text-slate-500">مهام منجزة: <b className="text-success">{p.tasksDone}</b> · مفتوحة: <b>{p.tasksOpen}</b> · تحضير مسجل: <b>{p.attendanceMarked}</b></div>
                <div className="mt-1 text-small font-extrabold text-primary">النقاط: {p.score}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {comm && (
        <section className="card space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">عمولات التحصيل 💰 <span className="text-xs font-normal text-slate-400">(نسبة موحدة من تحصيل مجموعات كل مدرس)</span></h2>
            <div className="flex items-center gap-1 text-xs">
              <input value={rateDraft} onChange={(e) => setRateDraft(e.target.value)} type="number" min={0} max={50}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center" />
              <span>%</span>
              <button
                onClick={async () => {
                  const r = await fetch("/api/team/commissions", {
                    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rate: Number(rateDraft) }),
                  });
                  if (r.ok) load();
                }}
                className="rounded-lg bg-primary-light px-3 py-1 font-bold text-primary"
              >
                حفظ
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {comm.rows.map((c) => (
              <div key={c.name} className="rounded-xl bg-slate-50 p-3 text-small">
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-slate-500">محصّل مجموعاته: {c.collected.toLocaleString("ar-EG")} ج</div>
                <div className="font-extrabold text-success">العمولة ({comm.rate}%): {c.commission.toLocaleString("ar-EG")} ج</div>
              </div>
            ))}
            {comm.rows.length === 0 && <div className="text-small text-slate-400">لا بيانات تحصيل.</div>}
          </div>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">المهام 📝</h2>
        <form onSubmit={addTask} className="grid gap-2 sm:grid-cols-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200}
            placeholder="مهمة جديدة..." className="rounded-xl border border-slate-200 px-4 py-2 sm:col-span-2" />
          <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
            <option value="">للكل</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <button className="btn-primary !py-2 text-small sm:col-span-4" disabled={busy}>إضافة المهمة</button>
        </form>
        <ul className="space-y-2">
          {(tasks ?? []).slice(0, 30).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <div>
                <span className={t.status === "done" ? "line-through text-slate-400" : "font-bold"}>{t.title}</span>
                <span className="mx-2 text-xs text-slate-400">{t.users?.full_name ?? "للكل"}{t.due_date ? ` · حتى ${t.due_date}` : ""}</span>
              </div>
              {t.status === "open" && (
                <button onClick={() => taskStatus(t.id, "done")} className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold text-success">تم ✓</button>
              )}
            </li>
          ))}
          {(tasks ?? []).length === 0 && <div className="text-small text-slate-400">لا مهام بعد.</div>}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">الإجازات 🏖️</h2>
        <form onSubmit={addLeave} className="grid gap-2 sm:grid-cols-4">
          <input value={lv.from_date} onChange={(e) => setLv({ ...lv, from_date: e.target.value })} required type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <input value={lv.to_date} onChange={(e) => setLv({ ...lv, to_date: e.target.value })} required type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <input value={lv.reason} onChange={(e) => setLv({ ...lv, reason: e.target.value })} maxLength={300} placeholder="السبب (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <button className="btn-secondary !py-2 text-small" disabled={busy}>طلب إجازة</button>
        </form>
        <ul className="space-y-2">
          {leaves.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <div>
                <span className="font-bold">{l.users?.full_name ?? ""}</span>
                <span className="mx-2 text-xs text-slate-500" dir="ltr">{l.from_date} → {l.to_date}</span>
                {l.reason && <span className="block text-xs text-slate-400">{l.reason}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${l.status === "approved" ? "bg-success/10 text-success" : l.status === "rejected" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                  {l.status === "approved" ? "معتمدة ✅" : l.status === "rejected" ? "مرفوضة" : "بانتظار ⏳"}
                </span>
                {isOwner && l.status === "pending" && (
                  <>
                    <button onClick={() => decideLeave(l.id, "approved")} className="rounded-lg bg-success/10 px-3 py-1 text-xs font-bold text-success">اعتماد</button>
                    <button onClick={() => decideLeave(l.id, "rejected")} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">رفض</button>
                  </>
                )}
              </div>
            </li>
          ))}
          {leaves.length === 0 && <div className="text-small text-slate-400">لا طلبات.</div>}
        </ul>
      </section>
    </div>
  );
}
