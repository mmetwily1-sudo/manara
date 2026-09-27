"use client";

import { useEffect, useState } from "react";
import { waTo } from "@/lib/wa";

type Inv = { id: string; student: string; period: string; amount: number; paid: number; status: string; receipt_no: number | null };
type Od = { student_id: string; name: string; phone: string | null; due: number; periods: string[]; score?: number };

const ST: Record<string, [string, string]> = {
  paid: ["مسددة ✅", "bg-success/10 text-success"],
  partial: ["جزئية 🟡", "bg-warning/10 text-warning"],
  unpaid: ["غير مسددة ⚪", "bg-slate-100 text-slate-500"],
  overdue: ["متأخرة 🔴", "bg-danger/10 text-danger"],
};

/** الفواتير: القائمة + الإصدار + المتأخرات + تصدير — ما كان موجوداً إلا عبر التحصيل */
export default function InvoicesPage() {
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [overdues, setOverdues] = useState<Od[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/invoices");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setInvs(j.invoices); setOverdues(j.overdues ?? []); }
      else setErr("تعذر التحميل.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

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

  const total = (invs ?? []).reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const collected = (invs ?? []).reduce((s, x) => s + Number(x.paid ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الفواتير 🧾</h1>
          <p className="mt-1 text-small text-slate-500">كل فواتير السنتر — إصدار ومشاركة وتحصيل</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?scope=invoices" className="btn-secondary text-small">تصدير CSV ⬇️</a>
          <button onClick={onIssue} disabled={issuing} className="btn-primary text-small disabled:opacity-50">
            {issuing ? "جاري..." : "إصدار فواتير الشهر"}
          </button>
        </div>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <section className="grid grid-cols-3 gap-4">
        {[
          ["إجمالي الفواتير", total, "primary"],
          ["المحصّل", collected, "success"],
          ["المتبقي", total - collected, "warning"],
        ].map(([l, v, tone]) => (
          <div key={l as string} className="card p-5 text-center">
            <div className={`text-2xl font-extrabold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary"}`}>
              {Number(v).toLocaleString("ar-EG")} ج
            </div>
            <div className="mt-1 text-small text-slate-500">{l}</div>
          </div>
        ))}
      </section>

      {overdues.length > 0 && (
        <section className="card space-y-2 border-danger/25 p-5">
          <h2 className="font-bold text-danger">أعلى المتأخرين ({overdues.slice(0, 5).length}) ⚠️</h2>
          {overdues.slice(0, 5).map((o) => {
            const link = waTo(o.phone, `تذكير من سنترنا: على الطالب ${o.name} مبلغ ${o.due.toLocaleString("ar-EG")} جنيه عن ${o.periods.join("، ")} — برجاء السداد.`);
            return (
              <div key={o.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/5 px-4 py-2.5 text-small">
                <span><b>{o.name}</b> <span className="mx-2 font-extrabold text-danger">{o.due.toLocaleString("ar-EG")} ج</span></span>
                {link && <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white">واتساب 💬</a>}
              </div>
            );
          })}
        </section>
      )}

      <section className="card overflow-hidden">
        {invs === null ? (
          <div className="p-8 text-center text-slate-400">جاري التحميل...</div>
        ) : invs.length === 0 ? (
          <div className="p-8 text-center text-small text-slate-500">لا فواتير بعد — أصدر فواتير الشهر بالزر بالأعلى.</div>
        ) : (
          <table className="w-full text-right text-small">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>{["الطالب", "الفترة", "المبلغ", "المدفوع", "الحالة"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invs.slice(0, 100).map((x) => {
                const [label, tone] = ST[x.status] ?? [x.status, "bg-slate-100"];
                return (
                  <tr key={x.id}>
                    <td className="px-4 py-3 font-bold">{x.student}</td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">{x.period}</td>
                    <td className="px-4 py-3 font-bold">{Number(x.amount).toLocaleString("ar-EG")} ج</td>
                    <td className="px-4 py-3 text-success">{Number(x.paid).toLocaleString("ar-EG")} ج</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
