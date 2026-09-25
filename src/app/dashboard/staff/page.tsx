"use client";

import { useEffect, useState } from "react";

type Branch = { id: string; name: string; address: string | null };
type Member = { id: string; name: string; phone: string; role: string; role_label: string; branch: string; is_owner: boolean };

const ROLES = [["supervisor", "مشرف"], ["assistant", "مساعد تحضير"], ["accountant", "محاسب"]];

/** الفروع والطاقم — المالك فقط (المنع على السيرفر) */
export default function StaffPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Member[]>([]);
  const [err, setErr] = useState("");
  const [bName, setBName] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", role: "assistant", branch: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [rb, rs] = await Promise.all([fetch("/api/branches"), fetch("/api/staff")]);
      const jb = await rb.json().catch(() => null);
      const js = await rs.json().catch(() => null);
      if (rb.ok && jb?.ok) setBranches(jb.branches);
      if (rs.ok && js?.ok) setStaff(js.staff);
      else if (rs.status === 403) setErr("هذه الصفحة لمالك السنتر فقط.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function addBranch(e: React.FormEvent) {
    e.preventDefault();
    if (bName.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await fetch("/api/branches", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: bName.trim() }),
      });
      if (r.ok) { setBName(""); load(); }
      else setErr("فشل إضافة الفرع.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, branch_id: form.branch || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ email: "", password: "", name: "", phone: "", role: "assistant", branch: "" });
        load();
      } else setErr(j?.error === "auth_failed" ? "البريد مسجل مسبقاً أو البيانات ناقصة." : "فشل الدعوة: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`إزالة ${name} من الطاقم؟`)) return;
    try {
      const r = await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
      if (r.ok) load();
      else setErr("فشل الإزالة.");
    } catch { setErr("تعذر الاتصال."); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">الفروع والطاقم 🏢</h1>
        <p className="mt-1 text-small text-slate-500">مشرف ومحاسب ومساعد — بصلاحيات مفروضة على السيرفر</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">الفروع ({branches.length})</h2>
        <form onSubmit={addBranch} className="flex gap-2">
          <input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="اسم الفرع (مثال: فرع المهندسين)"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <button disabled={busy} className="btn-primary shrink-0">إضافة</button>
        </form>
        <ul className="flex flex-wrap gap-2 text-small">
          {branches.map((b) => <li key={b.id} className="rounded-full bg-primary-light px-4 py-1.5 font-bold text-primary">{b.name}</li>)}
          {branches.length === 0 && <li className="text-xs text-slate-400">لا فروع — الكل يعمل على السنتر الرئيسي.</li>}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">دعوة عضو طاقم</h2>
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الاسم الكامل" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="رقم الموبايل" required dir="ltr" className="rounded-xl border border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="البريد الإلكتروني للدخول" type="email" required dir="ltr" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="كلمة سر مؤقتة (8+ حروف وأرقام)" type="password" required minLength={8} dir="ltr" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <option value="">كل الفروع</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button disabled={busy} className="btn-primary sm:col-span-2 disabled:opacity-50">{busy ? "جاري..." : "إرسال الدعوة"}</button>
        </form>
        <p className="text-[11px] text-slate-400">المشرف: محتوى وتحضير بلا مالية · المساعد: تحضير فقط · المحاسب: مالية فقط — تُفرض على السيرفر لا بإخفاء الأزرار.</p>
      </section>

      <section className="card overflow-hidden">
        <table className="w-full text-right text-small">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{["الاسم", "الدور", "الفرع", "الهاتف", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-bold">{s.name}{s.is_owner && " (أنت)"}</td>
                <td className="px-4 py-3">{s.role_label}</td>
                <td className="px-4 py-3 text-slate-500">{s.branch}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">{s.phone}</td>
                <td className="px-4 py-3">{!s.is_owner && s.role !== "teacher_admin" && (
                  <button onClick={() => remove(s.id, s.name)} className="text-xs font-bold text-danger">إزالة</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
