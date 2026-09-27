"use client";

import { useEffect, useState } from "react";

type E = { id: string; title: string; amount: number; category: string; spent_at: string; note: string };
type A = { id: string; audit_date: string; expected: number; actual: number; diff: number; note: string; status: string };

/** المصروفات التشغيلية + جرد الخزنة بعجز/فائض وموافقة المالك */
export default function ExpensesPage() {
  const [exps, setExps] = useState<E[] | null>(null);
  const [monthTotal, setMonthTotal] = useState(0);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [audits, setAudits] = useState<A[]>([]);
  const [form, setForm] = useState({ title: "", amount: "", category: "general", spent_at: "", note: "" });
  const [count, setCount] = useState({ expected: "", actual: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const [re, ra] = await Promise.all([fetch("/api/expenses"), fetch("/api/cash-audits")]);
      const je = await re.json().catch(() => null);
      const ja = await ra.json().catch(() => null);
      if (re.ok && je?.ok) { setExps(je.expenses); setMonthTotal(je.monthTotal); setCats(je.cats ?? {}); }
      else setErr("تعذر التحميل — مالك/محاسب فقط.");
      if (ra.ok && ja?.ok) setAudits(ja.audits);
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      if (r.ok) { setForm({ title: "", amount: "", category: "general", spent_at: "", note: "" }); load(); }
      else setErr("فشل التسجيل.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function addCount(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/cash-audits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected: Number(count.expected), actual: Number(count.actual), note: count.note }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setCount({ expected: "", actual: "", note: "" }); load(); }
      else setErr("فشل التسجيل.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function decide(id: string, status: string) {
    try {
      const r = await fetch("/api/cash-audits", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (r.ok) load();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">المصروفات والجرد 💸</h1>
        <p className="mt-1 text-small text-slate-500">مصروف الشهر: <b className="text-danger">{monthTotal.toLocaleString("ar-EG")} ج</b></p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">جرد الخزنة 🧮 <span className="text-xs font-normal text-slate-400">المتوقع مقابل الفعلي — العجز/الفائض بموافقة المالك</span></h2>
        <form onSubmit={addCount} className="grid gap-2 sm:grid-cols-4">
          <input value={count.expected} onChange={(e) => setCount({ ...count, expected: e.target.value })} required type="number" min={0} placeholder="المتوقع (ج)" className="rounded-xl border border-slate-200 px-4 py-2" />
          <input value={count.actual} onChange={(e) => setCount({ ...count, actual: e.target.value })} required type="number" min={0} placeholder="الفعلي (ج)" className="rounded-xl border border-slate-200 px-4 py-2" />
          <input value={count.note} onChange={(e) => setCount({ ...count, note: e.target.value })} maxLength={300} placeholder="ملاحظة" className="rounded-xl border border-slate-200 px-4 py-2" />
          <button className="btn-secondary !py-2 text-small" disabled={busy}>تسجيل الجرد</button>
        </form>
        {audits.slice(0, 10).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
            <div>
              <span className="font-bold" dir="ltr">{a.audit_date}</span>
              <span className={`mx-2 font-extrabold ${a.diff === 0 ? "text-success" : a.diff < 0 ? "text-danger" : "text-warning"}`}>
                {a.diff === 0 ? "مطابق ✅" : a.diff < 0 ? `عجز ${Math.abs(a.diff)} ج` : `فائض ${a.diff} ج`}
              </span>
              {a.note && <span className="text-xs text-slate-400">· {a.note}</span>}
            </div>
            {a.status === "pending" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-warning">بانتظار موافقة المالك ⏳</span>
                <button onClick={() => decide(a.id, "approved")} className="rounded-lg bg-success/10 px-3 py-1 text-xs font-bold text-success">اعتماد</button>
                <button onClick={() => decide(a.id, "rejected")} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">رفض</button>
              </div>
            ) : (
              <span className="text-xs font-bold text-slate-400">{a.status === "approved" ? "معتمد ✅" : "مرفوض"}</span>
            )}
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">تسجيل مصروف ➕</h2>
        <form onSubmit={addExpense} className="grid gap-2 sm:grid-cols-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={150}
            placeholder="البند (مثال: إيجار يونيو)" className="rounded-xl border border-slate-200 px-4 py-2" />
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required type="number" min={1}
            placeholder="المبلغ (ج)" className="rounded-xl border border-slate-200 px-4 py-2" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={form.spent_at} onChange={(e) => setForm({ ...form, spent_at: e.target.value })} type="date" className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300}
            placeholder="ملاحظة" className="rounded-xl border border-slate-200 px-4 py-2" />
          <button className="btn-primary sm:col-span-3" disabled={busy}>{busy ? "جاري..." : "تسجيل المصروف"}</button>
        </form>
        <ul className="space-y-2">
          {(exps ?? []).slice(0, 30).map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <div>
                <span className="font-bold">{x.title}</span>
                <span className="mx-2 text-xs text-slate-400">{cats[x.category] ?? x.category} · <span dir="ltr">{x.spent_at}</span></span>
              </div>
              <span className="font-extrabold text-danger">{Number(x.amount).toLocaleString("ar-EG")} ج</span>
            </li>
          ))}
          {(exps ?? []).length === 0 && <div className="text-small text-slate-400">لا مصروفات مسجلة.</div>}
        </ul>
      </section>
    </div>
  );
}
