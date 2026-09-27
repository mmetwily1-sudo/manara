"use client";

import { useEffect, useState } from "react";

type G = { id: string; title: string; kind: string; target: number; current: number; pct: number; deadline: string | null; status: string };
type Plan = { avg: number | null; lessons: { lesson: string; subject: string }[]; steps: string[] };

const KINDS: Record<string, string> = { points: "نقاط ⭐", attendance: "حضور 📋", exam_avg: "متوسط درجات 📝" };

/** أهداف الطلاب + خطته التعليمية: تقدم محسوب تلقائياً من البيانات */
export default function GoalsPage() {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [sid, setSid] = useState("");
  const [goals, setGoals] = useState<G[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({ title: "", kind: "points", target: "100", deadline: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/students").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setStudents((j.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, []);

  async function load(id: string) {
    setSid(id); setGoals(null); setPlan(null);
    if (!id) return;
    try {
      const [rg, rp] = await Promise.all([fetch(`/api/goals?student_id=${id}`), fetch(`/api/students/${id}/plan`)]);
      const jg = await rg.json().catch(() => null);
      const jp = await rp.json().catch(() => null);
      if (rg.ok && jg?.ok) setGoals(jg.goals);
      if (rp.ok && jp?.ok) setPlan(jp);
    } catch {}
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!sid) return;
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: sid, ...form, target: Number(form.target) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setForm({ title: "", kind: "points", target: "100", deadline: "" }); load(sid); setNotice("تم إنشاء الهدف 🎯"); }
      else setNotice("فشل الإنشاء.");
    } catch { setNotice("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    try {
      const r = await fetch("/api/goals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (r.ok) load(sid);
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">أهداف الطلاب 🎯</h1>
          <p className="mt-1 text-small text-slate-500">التقدم يُحسب تلقائياً من الحضور والدرجات والنقاط</p>
        </div>
        <select value={sid} onChange={(e) => load(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          <option value="">اختر الطالب…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </header>

      {notice && <div className="card p-4 text-small font-bold text-primary">{notice}</div>}

      {sid && plan && (
        <section className="card space-y-2 border-primary/20 p-5">
          <h2 className="font-bold">خطته التعليمية 🗺️ {plan.avg !== null && <span className="text-small font-normal text-slate-500">(متوسطه: {plan.avg}%)</span>}</h2>
          <ul className="space-y-1 text-small text-slate-600">
            {plan.steps.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
        </section>
      )}

      {sid && (
        <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120}
            placeholder="عنوان الهدف (مثال: 200 نقطة قبل نهاية الشهر)" className="rounded-xl border border-slate-200 px-4 py-2.5 sm:col-span-2" />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} type="number" min={1} placeholder="المستهدف" className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <input value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} type="date" className="rounded-xl border border-slate-200 px-4 py-2.5 sm:col-span-2" />
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري..." : "إنشاء الهدف"}</button>
        </form>
      )}

      {goals === null ? (
        sid && <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : goals.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا أهداف بعد — أنشئ أول هدف بالأعلى.</div>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">{g.title}</span>
                  <span className="mx-2 text-xs text-slate-400">{KINDS[g.kind]} · المستهدف {g.target}{g.deadline ? ` · حتى ${g.deadline}` : ""}</span>
                </div>
                {g.status === "active" ? (
                  <div className="flex gap-2">
                    <button onClick={() => setStatus(g.id, "done")} className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold text-success">إنجاز ✓</button>
                    <button onClick={() => setStatus(g.id, "cancelled")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">إلغاء</button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-400">{g.status === "done" ? "منجز 🎉" : "ملغي"}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" dir="ltr">
                  <div className={`h-full rounded-full ${g.pct >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${g.pct}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-500">{g.current}/{g.target} ({g.pct}%)</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
