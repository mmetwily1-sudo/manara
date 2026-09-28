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

/** تقسيط + عربون + استرداد — أدوات مالية بصفحة الفواتير */
function FinanceTools({ onDone }: { onDone: () => void }) {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [ins, setIns] = useState({ student_id: "", title: "", total: "", parts: "3" });
  const [dep, setDep] = useState({ student_id: "", amount: "", note: "" });
  const [refunds, setRefunds] = useState<{ id: string; amount: number; reason: string; status: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/students").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setStudents((j.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
    fetch("/api/refunds").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setRefunds(j.refunds);
    }).catch(() => {});
  }, []);

  async function installment(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/invoices/installments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ins, total: Number(ins.total), parts: Number(ins.parts) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsg(`تم إنشاء خطة ${j.parts} أقساط بإجمالي ${j.total} ج ✅`); setIns({ student_id: "", title: "", total: "", parts: "3" }); onDone(); }
      else setMsg("فشل إنشاء الخطة.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function deposit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/invoices/deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dep, amount: Number(dep.amount) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsg(`تم تسجيل عربون ${j.amount} ج 🪑`); setDep({ student_id: "", amount: "", note: "" }); onDone(); }
      else setMsg("فشل التسجيل.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function decideRefund(id: string, status: string) {
    try {
      const r = await fetch("/api/refunds", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (r.ok) {
        const jr = await fetch("/api/refunds").then((x) => x.json()).catch(() => null);
        if (jr?.ok) setRefunds(jr.refunds);
        onDone();
      }
    } catch {}
  }

  return (
    <>
      {msg && <div className="card p-3 text-small font-bold text-primary">{msg}</div>}
      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={installment} className="card space-y-2 p-5">
          <h2 className="font-bold">خطة تقسيط 🗓️</h2>
          <select value={ins.student_id} onChange={(e) => setIns({ ...ins, student_id: e.target.value })} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="">الطالب…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={ins.title} onChange={(e) => setIns({ ...ins, title: e.target.value })} required maxLength={120} placeholder="البيان (مثال: مصروفات الترم)" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <div className="flex gap-2">
            <input value={ins.total} onChange={(e) => setIns({ ...ins, total: e.target.value })} required type="number" min={1} placeholder="الإجمالي" className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
            <input value={ins.parts} onChange={(e) => setIns({ ...ins, parts: e.target.value })} type="number" min={2} max={24} placeholder="أقساط" className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-small" />
          </div>
          <button className="btn-secondary w-full !py-2 text-small" disabled={busy}>إنشاء الأقساط</button>
        </form>
        <form onSubmit={deposit} className="card space-y-2 p-5">
          <h2 className="font-bold">عربون حجز مقعد 🪑</h2>
          <select value={dep.student_id} onChange={(e) => setDep({ ...dep, student_id: e.target.value })} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="">الطالب…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value })} required type="number" min={1} placeholder="المبلغ" className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
            <input value={dep.note} onChange={(e) => setDep({ ...dep, note: e.target.value })} maxLength={200} placeholder="ملاحظة" className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
          </div>
          <button className="btn-secondary w-full !py-2 text-small" disabled={busy}>تسجيل العربون</button>
        </form>
      </section>
      {refunds.filter((x) => x.status === "pending").length > 0 && (
        <section className="card space-y-2 border-warning/30 p-5">
          <h2 className="font-bold text-warning">طلبات استرداد بانتظار قرارك 💸</h2>
          {refunds.filter((x) => x.status === "pending").map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <span><b>{x.amount.toLocaleString("ar-EG")} ج</b> <span className="text-xs text-slate-400">· {x.reason || "بلا سبب"}</span></span>
              <div className="flex gap-2">
                <button onClick={() => decideRefund(x.id, "approved")} className="rounded-lg bg-success/10 px-3 py-1 text-xs font-bold text-success">اعتماد الاسترداد</button>
                <button onClick={() => decideRefund(x.id, "rejected")} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">رفض</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

/** الفواتير: القائمة + الإصدار + المتأخرات + تصدير — ما كان موجوداً إلا عبر التحصيل */
export default function InvoicesPage() {
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [overdues, setOverdues] = useState<Od[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [err, setErr] = useState("");
  const [coupons, setCoupons] = useState<{ id: string; code: string; pct: number; max_uses: number; used: number; expires_at: string | null; is_active: boolean }[] | null>(null);
  const [cform, setCform] = useState({ code: "", pct: "", max_uses: "100", expires_at: "" });
  const [couponCode, setCouponCode] = useState("");
  type Sch = { id: string; student_id: string; student: string; pct: number; reason: string; active: boolean };
  const [schs, setSchs] = useState<Sch[] | null>(null);
  const [schStudents, setSchStudents] = useState<{ id: string; name: string }[]>([]);
  const [sform, setSform] = useState({ student_id: "", pct: "", reason: "" });

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
  async function loadSchs() {
    try {
      const r = await fetch("/api/scholarships");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setSchs(j.rows);
    } catch {}
    try {
      const r = await fetch("/api/students");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setSchStudents((j.students ?? []).map((s: any) => ({ id: s.id, name: s.name ?? s.full_name ?? "" })));
    } catch {}
  }

  async function saveSch(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/scholarships", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sform.student_id, pct: Number(sform.pct), reason: sform.reason }),
    });
    if (r.ok) { setSform({ student_id: "", pct: "", reason: "" }); loadSchs(); }
  }

  async function toggleSch(id: string, active: boolean) {
    const r = await fetch("/api/scholarships", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }),
    });
    if (r.ok) loadSchs();
  }

  useEffect(() => { load(); loadCoupons(); loadSchs(); }, []);

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

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">المنح الدراسية 🎓 <span className="text-xs font-normal text-slate-400">خصم دائم يطبق تلقائياً عند الإصدار</span></h2>
        <form onSubmit={saveSch} className="grid gap-2 sm:grid-cols-4">
          <select value={sform.student_id} onChange={(e) => setSform({ ...sform, student_id: e.target.value })} required
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="">الطالب...</option>
            {schStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={sform.pct} onChange={(e) => setSform({ ...sform, pct: e.target.value })} placeholder="الخصم %" required inputMode="numeric" dir="ltr"
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <input value={sform.reason} onChange={(e) => setSform({ ...sform, reason: e.target.value })} placeholder="السبب (تفوق/ظروف...)" maxLength={200}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <button className="btn-primary !py-2 text-small">حفظ المنحة</button>
        </form>
        {schs === null ? <div className="text-xs text-slate-400">جاري التحميل...</div> :
          schs.length === 0 ? <div className="text-xs text-slate-400">لا منح بعد.</div> :
          <ul className="divide-y divide-slate-100 text-small">
            {schs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                <span><b>{s.student}</b> — خصم {s.pct}% {s.reason && <span className="text-xs text-slate-400">({s.reason})</span>}</span>
                <button onClick={() => toggleSch(s.id, !s.active)}
                  className={`text-xs font-bold ${s.active ? "text-danger" : "text-success"}`}>
                  {s.active ? "إيقاف" : "تفعيل"}
                </button>
              </li>
            ))}
          </ul>}
      </section>
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

      <FinanceTools onDone={load} />

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
