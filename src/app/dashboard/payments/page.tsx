"use client";

import { useEffect, useState } from "react";

type Payment = { id: string; student: string; amount: number; method: string; status: string; note: string | null; paid_at: string };
type Totals = { collectedMonth: number; collectedToday: number; expected: number; outstanding: number };
type Close = { date: string; total: number; count: number; byMethod: Record<string, { total: number; count: number }> };

const METHODS: Record<string, string> = { cash: "كاش", wallet: "محفظة", instapay: "انستاباي", card: "بطاقة", fawry: "فوري" };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [close, setClose] = useState<Close | null>(null);
  const [err, setErr] = useState("");
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [showCollect, setShowCollect] = useState(false);
  const [form, setForm] = useState({ studentId: "", amount: "", method: "cash", note: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [rp, rs] = await Promise.all([fetch("/api/payments"), fetch("/api/students")]);
      const jp = await rp.json().catch(() => null);
      const js = await rs.json().catch(() => null);
      if (!rp.ok || !jp?.ok) { setErr("تعذر تحميل الدفعات."); return; }
      setPayments(jp.payments);
      setTotals(jp.totals);
      if (jp.close) setClose(jp.close);
      if (rs.ok && js?.ok) setStudents(js.students.map((s: any) => ({ id: s.id, name: s.name })));
      setErr("");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function onReview(id: string, action: "confirm" | "reject") {
    if (!confirm(action === "confirm" ? "تأكيد استلام هذه الدفعة؟" : "رفض هذه المطالبة؟")) return;
    setErr("");
    try {
      const r = await fetch(`/api/payments/${id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) load();
      else setErr("فشل المراجعة: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }

  const pending = (payments ?? []).filter((p) => p.status === "pending");
  const history = (payments ?? []).filter((p) => p.status !== "pending");

  async function onCollect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ studentId: "", amount: "", method: "cash", note: "" });
        setShowCollect(false);
        load();
      } else setErr("فشل التسجيل: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  const fmt = (n: number) => `${n.toLocaleString("ar-EG")} ج`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">التحصيل</h1>
          <p className="mt-1 text-small text-slate-500">دورة الشهر · صفر عمولة</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?scope=payments" className="btn-secondary text-small">تصدير CSV ⬇️</a>
          <button onClick={() => setShowCollect((v) => !v)} className="btn-primary text-small">تسجيل دفعة</button>
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {showCollect && (
        <form onSubmit={onCollect} className="card grid gap-3 p-5 sm:grid-cols-2">
          <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required className="rounded-xl border border-slate-200 px-4 py-2.5 sm:col-span-2">
            <option value="">اختر الطالب…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="المبلغ بالجنيه" inputMode="decimal" required className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ملاحظة (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري الحفظ..." : "تأكيد الدفعة"}</button>
        </form>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["محصّل النهاردة", totals ? fmt(totals.collectedToday) : "…", "primary"],
          ["محصّل الشهر", totals ? fmt(totals.collectedMonth) : "…", "success"],
          ["المتوقع الشهري", totals ? fmt(totals.expected) : "…", "primary"],
          ["المتبقي", totals ? fmt(totals.outstanding) : "…", "warning"],
        ].map(([l, v, tone]) => (
          <div key={l as string} className="card p-5">
            <div className={`text-2xl font-extrabold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary"}`}>{v}</div>
            <div className="mt-1 text-small text-slate-500">{l}</div>
          </div>
        ))}
      </section>

      {close && close.count > 0 && (
        <section className="card space-y-3 border-primary/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">تقفيل اليوم 🧾 <span className="text-xs font-normal text-slate-400">({close.count} دفعات)</span></h2>
            <button onClick={() => window.print()} className="rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600">طباعة التقرير 🖨️</button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(close.byMethod).map(([mk, v]) => (
              <li key={mk} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span className="text-slate-500">{METHODS[mk] ?? mk} <span className="text-xs">×{v.count}</span></span>
                <span className="font-extrabold text-primary">{fmt(v.total)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3">
            <span className="font-bold">إجمالي الخزنة اليوم</span>
            <span className="text-xl font-extrabold text-primary">{fmt(close.total)}</span>
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="card space-y-3 border-warning/30 p-5">
          <h2 className="font-bold">مطالبات بانتظار المراجعة ({pending.length}) ⏳</h2>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-small">
                <div>
                  <span className="font-bold">{p.student}</span>
                  <span className="mx-2 text-success font-bold">{fmt(p.amount)}</span>
                  <span className="text-slate-500">{METHODS[p.method] ?? p.method}</span>
                  {p.note && <span className="block text-xs text-slate-400">{p.note}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onReview(p.id, "confirm")} className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white">تأكيد الاستلام</button>
                  <button onClick={() => onReview(p.id, "reject")} className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger">رفض</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        {payments === null ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل الدفعات...</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-small text-slate-500">لا توجد دفعات مسجلة بعد — سجّل أول دفعة بالزر بالأعلى.</div>
        ) : (
          <table className="w-full text-right text-small">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>{["الطالب", "المبلغ", "الطريقة", "ملاحظة", "الوقت"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-bold">{p.student}</td>
                  <td className="px-4 py-3 font-bold text-success">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{METHODS[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-slate-400">{p.note ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(p.paid_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
