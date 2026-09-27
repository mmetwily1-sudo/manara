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
  const [coupons, setCoupons] = useState<{ id: string; code: string; pct: number; max_uses: number; used: number; expires_at: string | null; is_active: boolean }[] | null>(null);
  const [cform, setCform] = useState({ code: "", pct: "", max_uses: "100", expires_at: "" });
  const [couponCode, setCouponCode] = useState("");

  async function loadCoupons() {
    try {
      const r = await fetch("/api/coupons");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setCoupons(j.coupons);
    } catch {}
  }

  async function load() {
    try {
      const r = await fetch("/api/invoices");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setInvs(j.invoices); setOverdues(j.overdues ?? []); }
      else setErr("تعذر التحميل.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); loadCoupons(); }, []);

  async function onIssue() {
    if (!confirm(`إصدار فواتير الشهر الحالي لكل التسجيلات النشطة؟${couponCode.trim() ? ` (بكوبون ${couponCode.trim().toUpperCase()})` : ""}`)) return;
    setIssuing(true); setErr("");
    try {
      const r = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue", coupon_code: couponCode.trim() || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setCouponCode(""); load(); loadCoupons(); }
      else setErr(j?.error === "bad_coupon" ? "الكوبون غير صالح أو منتهي." : "فشل الإصدار.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setIssuing(false); }
  }

  async function addCoupon(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try {
      const r = await fetch("/api/coupons", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cform, pct: Number(cform.pct), max_uses: Number(cform.max_uses) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setCform({ code: "", pct: "", max_uses: "100", expires_at: "" }); loadCoupons(); }
      else setErr("فشل إنشاء الكوبون.");
    } catch { setErr("تعذر الاتصال."); }
  }

  async function toggleCoupon(id: string, is_active: boolean) {
    try {
      const r = await fetch("/api/coupons", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active }),
      });
      if (r.ok) loadCoupons();
    } catch {}
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
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/export?scope=invoices" className="btn-secondary text-small">تصدير CSV ⬇️</a>
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="كوبون خصم (اختياري)"
            className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-center text-small font-mono" dir="ltr" />
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

      {coupons !== null && (
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">كوبونات الخصم 🎟️ <span className="text-xs font-normal text-slate-400">(مالك فقط — تُطبق عند الإصدار)</span></h2>
          <form onSubmit={addCoupon} className="grid gap-2 sm:grid-cols-5">
            <input value={cform.code} onChange={(e) => setCform({ ...cform, code: e.target.value })} required maxLength={24}
              placeholder="الكود (مثال: EARLY20)" className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-small" dir="ltr" />
            <input value={cform.pct} onChange={(e) => setCform({ ...cform, pct: e.target.value })} required type="number" min={1} max={90}
              placeholder="الخصم %" className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <input value={cform.max_uses} onChange={(e) => setCform({ ...cform, max_uses: e.target.value })} type="number" min={1}
              placeholder="مرات الاستخدام" className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <input value={cform.expires_at} onChange={(e) => setCform({ ...cform, expires_at: e.target.value })} type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <button className="btn-secondary !py-2 text-small">إضافة</button>
          </form>
          {coupons.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <div>
                <span className="font-mono font-bold" dir="ltr">{c.code}</span>
                <span className="mx-2 font-extrabold text-success">{c.pct}%</span>
                <span className="text-xs text-slate-400">استُخدم {c.used}/{c.max_uses}{c.expires_at ? ` · حتى ${c.expires_at}` : ""}</span>
              </div>
              <button onClick={() => toggleCoupon(c.id, !c.is_active)}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${c.is_active ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400"}`}>
                {c.is_active ? "نشط ✅" : "موقوف ⏸️"}
              </button>
            </div>
          ))}
          {coupons.length === 0 && <div className="text-small text-slate-400">لا كوبونات بعد.</div>}
        </section>
      )}

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
