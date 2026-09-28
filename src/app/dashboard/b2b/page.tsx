"use client";

import { useEffect, useState } from "react";

type C = { id: string; org_name: string; contact: string; value: number; start_date: string | null; end_date: string | null; notes: string; status: string };

/** عقود المدارس والشركات B2B — شريحة مؤسسية */
type QB = { id: string; school_name: string; contact: string; subject: string; price: number; status: string; status_label: string; access_until: string | null };

/** بيع بنك الأسئلة للمدارس: طلب + تفعيل حتى تاريخ */
function QbOrders() {
  const [rows, setRows] = useState<QB[]>([]);
  const [form, setForm] = useState({ school_name: "", contact: "", subject: "", price: "" });
  async function load() {
    try {
      const r = await fetch("/api/b2b/qb-orders", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setRows(j.rows ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/b2b/qb-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price || 0) }),
    });
    if (r.ok) { setForm({ school_name: "", contact: "", subject: "", price: "" }); load(); }
  }
  async function setStatus(id: string, status: string) {
    const r = await fetch("/api/b2b/qb-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
    });
    if (r.ok) load();
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">بيع بنك الأسئلة 🏫</h2>
      <form onSubmit={create} className="grid gap-2 sm:grid-cols-5">
        <input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} placeholder="المدرسة" required maxLength={150}
          className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="جهة التواصل" maxLength={100}
          className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="المادة" maxLength={80}
          className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="السعر" inputMode="decimal" dir="ltr"
          className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <button className="btn-primary !py-2 text-small">طلب جديد</button>
      </form>
      {rows.length > 0 && (
        <ul className="divide-y divide-slate-100 text-small">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{o.school_name}</b> {o.subject && <span className="text-xs text-slate-400">({o.subject})</span>} — {o.price} ج ·
                <span className={`text-xs font-bold ${o.status === "active" ? "text-success" : o.status === "expired" ? "text-slate-400" : "text-warning"}`}> {o.status_label}</span>
                {o.access_until && <span className="text-xs text-slate-400"> حتى {o.access_until}</span>}</span>
              <span className="flex gap-2">
                {o.status === "pending" && <button onClick={() => setStatus(o.id, "active")} className="text-xs font-bold text-success">تفعيل سنة ✅</button>}
                {o.status === "active" && <button onClick={() => setStatus(o.id, "expired")} className="text-xs font-bold text-danger">إنهاء</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function B2bPage() {
  const [list, setList] = useState<C[] | null>(null);
  const [form, setForm] = useState({ org_name: "", contact: "", value: "", start_date: "", end_date: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/b2b");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.contracts);
      else setErr("تعذر التحميل — للمالك فقط.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/b2b", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, value: Number(form.value) }),
      });
      if (r.ok) { setForm({ org_name: "", contact: "", value: "", start_date: "", end_date: "", notes: "" }); load(); }
      else setErr("فشل الإنشاء.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    try {
      const r = await fetch("/api/b2b", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (r.ok) load();
    } catch {}
  }

  const activeValue = (list ?? []).filter((c) => c.status === "active").reduce((s, c) => s + Number(c.value ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">عقود B2B 🏢</h1>
        <p className="mt-1 text-small text-slate-500">مدارس وشركات — قيمة العقود النشطة <b className="text-success">{activeValue.toLocaleString("ar-EG")} ج</b></p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <form onSubmit={create} className="card grid gap-2 p-5 sm:grid-cols-3">
        <input value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} required maxLength={150}
          placeholder="اسم المدرسة/الشركة" className="rounded-xl border border-slate-200 px-4 py-2" />
        <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={150}
          placeholder="جهة التواصل" className="rounded-xl border border-slate-200 px-4 py-2" />
        <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} type="number" min={0}
          placeholder="القيمة (ج)" className="rounded-xl border border-slate-200 px-4 py-2" />
        <input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} type="date" className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
        <input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} type="date" className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000}
          placeholder="ملاحظات" className="rounded-xl border border-slate-200 px-4 py-2" />
        <button className="btn-primary sm:col-span-3" disabled={busy}>{busy ? "جاري..." : "إضافة العقد"}</button>
      </form>

      <ul className="space-y-2">
        {(list ?? []).map((c) => (
          <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <span className="font-bold">{c.org_name}</span>
              <span className="mx-2 text-small font-extrabold text-success">{Number(c.value).toLocaleString("ar-EG")} ج</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.status === "active" ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400"}`}>
                {c.status === "active" ? "نشط ✅" : c.status === "done" ? "مكتمل" : "ملغي"}
              </span>
              {(c.start_date || c.end_date) && <span className="mx-2 text-xs text-slate-400" dir="ltr">{c.start_date ?? "?"} → {c.end_date ?? "؟"}</span>}
              {c.notes && <span className="block text-xs text-slate-400">{c.notes}</span>}
            </div>
            {c.status === "active" && (
              <div className="flex gap-2">
                <button onClick={() => setStatus(c.id, "done")} className="rounded-lg bg-success/10 px-3 py-1 text-xs font-bold text-success">إتمام</button>
                <button onClick={() => setStatus(c.id, "cancelled")} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">إلغاء</button>
              </div>
            )}
          </li>
        ))}
        {(list ?? []).length === 0 && <div className="card p-8 text-center text-small text-slate-500">لا عقود بعد.</div>}
      </ul>
      <QbOrders />
    </div>
  );
}
