"use client";

import { useEffect, useState } from "react";

type Item = { user_id: string; name: string; base: number; bonus: number; deduction: number; net: number; note: string };
type Run = { id: string; month: string; status: string; total: number; items: Item[] };

/** مسير الرواتب: توليد شهري من العقود + إضافات/خصومات + اعتماد */
export default function PayrollPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState({ run: "", user: "", bonus: "", deduction: "", note: "" });

  async function load() {
    try {
      const r = await fetch("/api/payroll");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setRuns(j.runs);
      else if (r.status === 403) setErr("للمالك فقط.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/payroll", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) load();
      else setErr(j?.error === "exists" ? "مسير هذا الشهر موجود." : j?.error === "no_contracts" ? "لا عقود نشطة." : "فشل التوليد.");
    } catch { setErr("تعذر الاتصال."); }
  }

  async function approve(run_id: string) {
    if (!confirm("اعتماد المسير نهائياً؟")) return;
    const r = await fetch("/api/payroll", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id, action: "approve" }),
    });
    if (r.ok) load();
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/payroll", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        run_id: edit.run, user_id: edit.user, action: "item",
        bonus: Number(edit.bonus || 0), deduction: Number(edit.deduction || 0), note: edit.note,
      }),
    });
    if (r.ok) { setEdit({ run: "", user: "", bonus: "", deduction: "", note: "" }); load(); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">مسير الرواتب 💰</h1>
        <p className="mt-1 text-small text-slate-500">توليد شهري من العقود النشطة + اعتماد</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      <form onSubmit={generate} className="card flex gap-2 p-4">
        <input value={month} onChange={(e) => setMonth(e.target.value)} type="month" required
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2" dir="ltr" />
        <button className="btn-primary !py-2 text-small">توليد المسير</button>
      </form>
      {runs === null ? <div className="card p-6 text-center text-slate-400">جاري التحميل...</div> :
        runs.length === 0 ? <div className="card p-6 text-center text-small text-slate-500">لا مسيرات بعد.</div> :
        runs.map((run) => (
          <section key={run.id} className="card space-y-2 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold" dir="ltr">{run.month}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${run.status === "approved" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {run.status === "approved" ? "معتمد ✅" : "مسودة"}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 text-small">
              {run.items.map((i) => (
                <li key={i.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-bold">{i.name}</span>
                  <span className="text-slate-500">أساسي {i.base} + إضافي {i.bonus} − خصم {i.deduction} = <b>{i.net}</b></span>
                  {run.status === "draft" && (
                    <button onClick={() => setEdit({ run: run.id, user: i.user_id, bonus: String(i.bonus), deduction: String(i.deduction), note: i.note })}
                      className="text-xs font-bold text-primary">تعديل</button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-small">
              <span className="font-bold">الإجمالي: {run.total} ج</span>
              {run.status === "draft" && <button onClick={() => approve(run.id)} className="btn-primary !px-4 !py-1.5 text-xs">اعتماد ✅</button>}
            </div>
            {edit.run === run.id && (
              <form onSubmit={saveItem} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
                <input value={edit.bonus} onChange={(e) => setEdit({ ...edit, bonus: e.target.value })} placeholder="إضافي" inputMode="decimal" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-1.5 text-small" />
                <input value={edit.deduction} onChange={(e) => setEdit({ ...edit, deduction: e.target.value })} placeholder="خصم" inputMode="decimal" dir="ltr" className="rounded-lg border border-slate-200 px-3 py-1.5 text-small" />
                <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="ملاحظة" maxLength={200} className="rounded-lg border border-slate-200 px-3 py-1.5 text-small" />
                <button className="btn-primary !py-1.5 text-xs">حفظ</button>
              </form>
            )}
          </section>
        ))}
    </div>
  );
}
