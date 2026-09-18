"use client";

import { useEffect, useState } from "react";

type Student = { id: string; name: string; phone: string | null; groups: { id: string; name: string }[] };
type Group = { id: string; name: string };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState("");
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", groupId: "" });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const [rs, rg] = await Promise.all([fetch("/api/students"), fetch("/api/groups")]);
      const js = await rs.json().catch(() => null);
      const jg = await rg.json().catch(() => null);
      if (!rs.ok || !js?.ok) { setErr("تعذر تحميل الطلاب."); return; }
      setStudents(js.students);
      if (rg.ok && jg?.ok) setGroups(jg.groups.map((g: any) => ({ id: g.id, name: g.name })));
      setErr("");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/students", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ name: "", phone: "", groupId: "" });
        setShowAdd(false);
        load();
      } else {
        setErr(j?.error === "phone_exists" ? "هذا الرقم مسجل لطالب آخر في سنترك." : "فشل الإضافة: " + (j?.error ?? "خطأ غير معروف"));
      }
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  function copyInvite() {
    const url = `${window.location.origin}/join`;
    navigator.clipboard?.writeText(`سجّل في سنترنا من هنا: ${url}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const visible = filterGroup
    ? (students ?? []).filter((s) => s.groups.some((g) => g.id === filterGroup))
    : students ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الطلاب</h1>
          <p className="mt-1 text-small text-slate-500">
            {students === null ? "…" : `${students.length} طالب`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyInvite} className="btn-secondary text-small">
            {copied ? "✓ تم النسخ" : "نسخ رابط التسجيل"}
          </button>
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-small">طالب جديد</button>
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {showAdd && (
        <form onSubmit={onAdd} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الطالب الكامل" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="رقم موبايل الطالب / ولي الأمر" dir="ltr" className="rounded-xl border border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
          <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <option value="">بدون مجموعة (لاحقاً)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ الطالب"}</button>
          <p className="text-xs text-slate-400 sm:col-span-2">سيتمكن الطالب من تفعيل حساب دخوله بنفس الرقم من صفحة التسجيل.</p>
        </form>
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterGroup("")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${!filterGroup ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>الكل</button>
          {groups.map((g) => (
            <button key={g.id} onClick={() => setFilterGroup(filterGroup === g.id ? "" : g.id)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${filterGroup === g.id ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>{g.name}</button>
          ))}
        </div>
      )}

      <section className="card overflow-hidden">
        {students === null ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل الطلاب...</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-small text-slate-500">لا يوجد طلاب بعد</p>
            <p className="mt-1 text-xs text-slate-400">أضف أول طالب بالزر بالأعلى، أو انسخ رابط التسجيل وأرسله لطلابك على واتساب.</p>
          </div>
        ) : (
          <table className="w-full text-right text-small">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>{["الطالب", "المجموعات", "الهاتف", "تقرير"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.groups.length ? s.groups.map((g) => g.name).join("، ") : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3"><a href={`/reports/parent/${s.id}`} className="text-xs font-bold text-primary hover:underline">تقرير 📄</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
