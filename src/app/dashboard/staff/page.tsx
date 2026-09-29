"use client";

import { useEffect, useState } from "react";

type Branch = { id: string; name: string; address: string | null; lat: number | null; lng: number | null };
type Member = { id: string; name: string; phone: string; role: string; role_label: string; branch: string; branch_id: string | null; is_owner: boolean };

const ROLES = [["supervisor", "مشرف"], ["assistant", "مساعد تحضير"], ["accountant", "محاسب"]];

/** الفروع والطاقم — المالك فقط (المنع على السيرفر) */
export default function StaffPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<Member[]>([]);
  const [err, setErr] = useState("");
  const [bName, setBName] = useState("");
  const [geo, setGeo] = useState({ branch_id: "", lat: "", lng: "" });

  async function saveGeo(e: React.FormEvent) {
    e.preventDefault();
    if (!geo.branch_id) return;
    try {
      const r = await fetch("/api/branches", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: geo.branch_id, lat: Number(geo.lat), lng: Number(geo.lng) }),
      });
      if (r.ok) { setGeo({ branch_id: "", lat: "", lng: "" }); load(); }
      else setErr("إحداثيات غير صالحة.");
    } catch { setErr("تعذر الاتصال."); }
  }
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", role: "assistant", branch: "" });
  const [busy, setBusy] = useState(false);
  type Contract = { id: string; user_id: string; name: string; salary_base: number; kind: string; kind_label: string; start_date: string; end_date: string | null };
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [cform, setCform] = useState({ user_id: "", salary_base: "", kind: "monthly" });
  type Review = { user_id: string; name: string; month: string; score: number; note: string };
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [rmonth, setRmonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [ravg, setRavg] = useState(0);
  const [rform, setRform] = useState({ user_id: "", score: "5", note: "" });

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
        body: JSON.stringify({ email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: form.role, branch_id: form.branch || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ email: "", password: "", name: "", phone: "", role: "assistant", branch: "" });
        load();
      } else setErr(j?.error === "auth_failed" ? "البريد مسجل مسبقاً أو البيانات ناقصة." : "فشل الدعوة: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function loadContracts() {
    try {
      const r = await fetch("/api/staff/contracts");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setContracts(j.contracts);
    } catch {}
  }
  useEffect(() => { loadContracts(); }, []);

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/staff/contracts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: cform.user_id, salary_base: Number(cform.salary_base), kind: cform.kind }),
      });
      if (r.ok) { setCform({ user_id: "", salary_base: "", kind: "monthly" }); loadContracts(); }
      else setErr("تعذر حفظ العقد.");
    } catch { setErr("تعذر الاتصال."); }
  }

  async function endContract(id: string) {
    if (!confirm("إنهاء هذا العقد؟")) return;
    try {
      const r = await fetch("/api/staff/contracts", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      if (r.ok) loadContracts();
    } catch {}
  }

  async function loadReviews(m: string) {
    try {
      const r = await fetch(`/api/staff/reviews?month=${m}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setReviews(j.reviews); setRavg(j.avg); }
    } catch {}
  }
  useEffect(() => { loadReviews(rmonth); }, [rmonth]);

  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/staff/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: rform.user_id, month: rmonth, score: Number(rform.score), note: rform.note }),
      });
      if (r.ok) { setRform({ user_id: "", score: "5", note: "" }); loadReviews(rmonth); }
      else setErr("تعذر حفظ التقييم.");
    } catch { setErr("تعذر الاتصال."); }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`إزالة ${name} من الطاقم؟`)) return;
    try {
      const r = await fetch(`/api/staff?id=${id}`, { method: "DELETE" });
      if (r.ok) load();
      else setErr("فشل الإزالة.");
    } catch { setErr("تعذر الاتصال."); }
  }

  async function move(id: string, patch: { branch_id?: string | null; role?: string }) {
    try {
      const r = await fetch("/api/staff", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (r.ok) load();
      else setErr("فشل التحديث.");
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
          {branches.map((b) => (
            <li key={b.id} className="rounded-full bg-primary-light px-4 py-1.5 font-bold text-primary">
              {b.name}{" "}
              {b.lat != null && b.lng != null && (
                <a href={`https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer" title="الاتجاهات" className="underline">📍</a>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={saveGeo} className="grid gap-2 sm:grid-cols-4">
          <select value={geo.branch_id} onChange={(e) => setGeo({ ...geo, branch_id: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
            <option value="">موقع الفرع على الخريطة...</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input value={geo.lat} onChange={(e) => setGeo({ ...geo, lat: e.target.value })} placeholder="خط العرض lat" inputMode="decimal" dir="ltr"
            className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <input value={geo.lng} onChange={(e) => setGeo({ ...geo, lng: e.target.value })} placeholder="خط الطول lng" inputMode="decimal" dir="ltr"
            className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
          <button className="btn-secondary !py-2 text-small">حفظ الموقع 📍</button>
        </form>
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
        <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-right text-small">
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
                <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-1">
                  {!s.is_owner && s.role !== "teacher_admin" && (
                    <>
                      <select value={s.branch_id ?? ""} onChange={(e) => move(s.id, { branch_id: e.target.value || null })}
                        title="الفرع" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <option value="">كل الفروع</option>
                        {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <select value={s.role} onChange={(e) => move(s.id, { role: e.target.value })}
                        title="الدور" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <option value="supervisor">مشرف</option>
                        <option value="assistant">مساعد</option>
                        <option value="accountant">محاسب</option>
                      </select>
                    </>
                  )}
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/t/${s.id}`;
                      navigator.clipboard?.writeText(link).then(() => alert("رابط صفحته العامة:\n" + link)).catch(() => {});
                    }}
                    className="text-xs font-bold text-primary"
                  >
                    رابط عام 🔗
                  </button>
                  {!s.is_owner && s.role !== "teacher_admin" && (
                    <button onClick={() => remove(s.id, s.name)} className="text-xs font-bold text-danger">إزالة</button>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">عقود الموظفين 📄</h2>
        <form onSubmit={saveContract} className="grid gap-2 sm:grid-cols-4">
          <select value={cform.user_id} onChange={(e) => setCform({ ...cform, user_id: e.target.value })} required
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="">اختر الموظف...</option>
            {staff.filter((s) => !s.is_owner && s.role !== "teacher_admin").map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.role_label}</option>
            ))}
          </select>
          <input value={cform.salary_base} onChange={(e) => setCform({ ...cform, salary_base: e.target.value })}
            placeholder="الراتب الأساسي" required inputMode="decimal" dir="ltr"
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <select value={cform.kind} onChange={(e) => setCform({ ...cform, kind: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="monthly">شهري</option>
            <option value="per_session">بالحصة</option>
            <option value="commission">عمولة</option>
          </select>
          <button className="btn-primary !py-2 text-small">حفظ العقد</button>
        </form>
        {contracts === null ? <div className="text-xs text-slate-400">جاري التحميل...</div> :
          contracts.length === 0 ? <div className="text-xs text-slate-400">لا عقود نشطة.</div> :
          <ul className="divide-y divide-slate-100 text-small">
            {contracts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-bold">{c.name}</span>
                <span className="text-slate-500">{c.salary_base} ج · {c.kind_label}</span>
                <button onClick={() => endContract(c.id)} className="text-xs font-bold text-danger">إنهاء</button>
              </li>
            ))}
          </ul>}
      </section>
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">تقييم الأداء ⭐</h2>
          <input value={rmonth} onChange={(e) => setRmonth(e.target.value)} type="month" required
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-small" dir="ltr" />
        </div>
        <div className="text-small text-slate-500">متوسط الشهر: <b>{ravg} / 5</b></div>
        <form onSubmit={saveReview} className="grid gap-2 sm:grid-cols-4">
          <select value={rform.user_id} onChange={(e) => setRform({ ...rform, user_id: e.target.value })} required
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="">اختر الموظف...</option>
            {staff.filter((s) => !s.is_owner && s.role !== "teacher_admin").map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={rform.score} onChange={(e) => setRform({ ...rform, score: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"⭐".repeat(n)} ({n})</option>)}
          </select>
          <input value={rform.note} onChange={(e) => setRform({ ...rform, note: e.target.value })}
            placeholder="ملاحظة (اختياري)" maxLength={500}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <button className="btn-primary !py-2 text-small">حفظ التقييم</button>
        </form>
        {reviews === null ? <div className="text-xs text-slate-400">جاري التحميل...</div> :
          reviews.length === 0 ? <div className="text-xs text-slate-400">لا تقييمات هذا الشهر.</div> :
          <ul className="divide-y divide-slate-100 text-small">
            {reviews.map((v) => (
              <li key={v.user_id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-bold">{v.name}</span>
                <span className="text-warning">{"⭐".repeat(v.score)}</span>
                {v.note && <span className="text-xs text-slate-500" dir="auto">{v.note}</span>}
              </li>
            ))}
          </ul>}
      </section>
    </div>
  );
}
