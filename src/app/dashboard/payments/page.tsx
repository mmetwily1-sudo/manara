"use client";

import { useEffect, useState } from "react";
import { waTo } from "@/lib/wa";

type Payment = { id: string; student: string; amount: number; method: string; status: string; note: string | null; paid_at: string; receipt_no: number | null };
type Overdue = { student_id: string; name: string; phone: string | null; due: number; periods: string[]; abs: number; score?: number; risk?: string; daysOverdue?: number };
type Totals = { collectedMonth: number; collectedToday: number; expected: number; outstanding: number };
type Close = { date: string; total: number; count: number; byMethod: Record<string, { total: number; count: number }> };

const METHODS: Record<string, string> = { cash: "كاش", wallet: "محفظة", instapay: "انستاباي", card: "بطاقة", fawry: "فوري" };

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [close, setClose] = useState<Close | null>(null);
  const [overdues, setOverdues] = useState<Overdue[] | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [err, setErr] = useState("");
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [showCollect, setShowCollect] = useState(false);
  const [form, setForm] = useState({ studentId: "", amount: "", method: "cash", note: "" });
  const [busy, setBusy] = useState(false);
  const [receiptShare, setReceiptShare] = useState<{ no: number | null; wa: string | null; url: string } | null>(null);

  async function load() {
    try {
      const [rp, rs, ri] = await Promise.all([fetch("/api/payments"), fetch("/api/students"), fetch("/api/invoices")]);
      const jp = await rp.json().catch(() => null);
      const js = await rs.json().catch(() => null);
      const ji = await ri.json().catch(() => null);
      if (!rp.ok || !jp?.ok) { setErr("تعذر تحميل الدفعات."); return; }
      setPayments(jp.payments);
      setTotals(jp.totals);
      if (jp.close) setClose(jp.close);
      if (ri.ok && ji?.ok) setOverdues(ji.overdues);
      if (rs.ok && js?.ok) setStudents(js.students.map((s: any) => ({ id: s.id, name: s.name })));
      setErr("");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function onRemindAll() {
    if (!confirm("إرسال تذكير تلقائي لكل متأخر مستحق (push + واتساب إن كان مربوطاً)؟")) return;
    setReminding(true); setErr("");
    try {
      const r = await fetch("/api/invoices/remind", { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) load();
      else setErr("فشل التذكير.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setReminding(false); }
  }

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

  async function onIssue() {
    if (!confirm("إصدار فواتير الشهر الحالي لكل التسجيلات النشطة؟")) return;
    setIssuing(true); setErr("");
    try {
      const r = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue" }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) load();
      else setErr("فشل الإصدار.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setIssuing(false); }
  }

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
        setReceiptShare({ no: j.receipt_no ?? null, wa: j.wa_receipt ?? null, url: j.receipt_url ?? "" });
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
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?scope=payments" className="btn-secondary text-small">تصدير CSV ⬇️</a>
          <button onClick={onIssue} disabled={issuing} className="btn-secondary text-small disabled:opacity-50">
            {issuing ? "جاري الإصدار..." : "إصدار فواتير الشهر 🧾"}
          </button>
          <button onClick={onRemindAll} disabled={reminding} className="btn-secondary text-small disabled:opacity-50">
            {reminding ? "جاري..." : "تذكير كل المتأخرين 🔔"}
          </button>
          <button onClick={() => setShowCollect((v) => !v)} className="btn-primary text-small">تسجيل دفعة</button>
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {receiptShare && (
        <section className="card space-y-2 border-success/30 bg-success/5 p-5">
          <div className="font-bold text-success">✅ تم التسجيل {receiptShare.no != null && <span>— إيصال #{receiptShare.no}</span>}</div>
          <div className="flex flex-wrap gap-2">
            {receiptShare.url && <a href={receiptShare.url} target="_blank" rel="noreferrer" className="btn-secondary !px-4 !py-2 text-xs">عرض الإيصال 🧾</a>}
            {receiptShare.wa && <a href={receiptShare.wa} target="_blank" rel="noreferrer" className="rounded-xl bg-success px-4 py-2 text-xs font-bold text-white">إرسال الإيصال واتساب 💬</a>}
            <button onClick={() => setReceiptShare(null)} className="px-3 py-2 text-xs text-slate-400">إغلاق</button>
          </div>
        </section>
      )}

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

      {overdues !== null && overdues.length > 0 && (
        <section className="card space-y-3 border-danger/25 p-5">
          <h2 className="font-bold text-danger">متأخرات مستحقة ({overdues.length}) 📋</h2>
          <ul className="space-y-2">
            {overdues.map((o, i) => {
              const link = waTo(o.phone, `السلام عليكم 👋 تذكير من سنترنا: على الطالب ${o.name} مبلغ مستحق ${o.due.toLocaleString("ar-EG")} جنيه عن ${o.periods.join("، ")} — برجاء السداد في أقرب وقت.`);
              return (
                <li key={o.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/5 px-4 py-3 text-small">
                  <div>
                    {i < 3 && <span className="me-2 rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">⚠️ أولوية {i + 1}</span>}
                    <span className="font-bold">{o.name}</span>
                    <span className="mx-2 font-extrabold text-danger">{fmt(o.due)}</span>
                    <span className="text-xs text-slate-500">{o.periods.join("، ")}</span>
                    {(o.daysOverdue ?? 0) > 0 && <span className="mx-2 text-[11px] text-slate-400">متأخر {o.daysOverdue} يوم</span>}
                    {o.abs > 0 && <span className="mx-2 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning">غياب الشهر: {o.abs}</span>}
                  </div>
                  {link && <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white">تذكير واتساب 💬</a>}
                </li>
              );
            })}
          </ul>
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
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-right text-small">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>{["الطالب", "المبلغ", "الطريقة", "إيصال", "ملاحظة", "الوقت", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-bold">{p.student}</td>
                  <td className="px-4 py-3 font-bold text-success">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{METHODS[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">{p.receipt_no != null ? `#${p.receipt_no}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{p.note ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(p.paid_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</td>
                  <td className="px-4 py-3">
                    {p.status === "confirmed" && (
                      <button
                        onClick={async () => {
                          const reason = prompt("سبب الاسترداد (يُعرض على المالك):", "");
                          if (reason === null) return;
                          try {
                            const r = await fetch("/api/refunds", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ payment_id: p.id, reason }),
                            });
                            if (r.ok) alert("تم إرسال طلب الاسترداد للمالك 💸");
                            else alert("تعذر إرسال الطلب.");
                          } catch { alert("تعذر الاتصال."); }
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-danger"
                      >
                        استرداد
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
