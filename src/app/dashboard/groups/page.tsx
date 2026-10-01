"use client";

import { useEffect, useState } from "react";

type Group = {
  id: string;
  name: string;
  grade_level: string | null;
  subject: string | null;
  monthly_fee: number;
  schedule: any[];
  students_count: number;
  capacity: number;
};

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", subject: "", fee: "", capacity: "" });
  const [capEdit, setCapEdit] = useState<Record<string, string>>({});

  async function saveCap(id: string) {
    const v = capEdit[id];
    if (v === undefined) return;
    try {
      const r = await fetch("/api/groups", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, capacity: Number(v) }),
      });
      if (r.ok) load();
      else setErr("فشل حفظ السعة.");
    } catch { setErr("تعذر الاتصال."); }
  }
  const [sched, setSched] = useState({ weekday: "6", start: "16:00", end: "18:00" });

  async function load() {
    try {
      const r = await fetch("/api/groups");
      const j = await r.json();
      if (r.ok && j.ok) { setGroups(j.groups); setErr(""); }
      else setErr(j.error === "unauth" ? "سجّل دخولك أولاً." : "تعذر تحميل المجموعات.");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name, grade_level: form.grade, subject: form.subject,
            monthly_fee: Number(form.fee) || 0,
            capacity: Math.max(0, Number(form.capacity) || 0),
            schedule: [{ weekday: Number(sched.weekday), start: sched.start, end: sched.end }],
          }),
      });
      const j = await r.json();
      if (r.ok && j.ok) { setForm({ name: "", grade: "", subject: "", fee: "", capacity: "" }); load(); }
      else setErr("فشل الإنشاء: " + (j.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`حذف مجموعة "${name}" نهائياً؟ سيتم إلغاء تسجيل طلابها.`)) return;
    const r = await fetch(`/api/groups?id=${id}`, { method: "DELETE" });
    if (r.ok) load();
    else alert("فشل الحذف");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">المجموعات والجدول</h1>
        <p className="mt-1 text-small text-slate-500">أنشئ مجموعاتك وحدد مواعيدها — تظهر في التحضير والجدول تلقائياً</p>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <div className="card p-6">
        <h2 className="font-bold">مجموعة جديدة</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم المجموعة (مثال: السبت — ٣ ثانوي)" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="الصف (مثال: ٣ ثانوي)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="المادة (مثال: فيزياء)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <input value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="الاشتراك الشهري (جنيه)" inputMode="decimal" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="السعة القصوى (0 = بلا حد)" inputMode="numeric" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <div className="flex items-center gap-2 text-small">
            <select value={sched.weekday} onChange={(e) => setSched({ ...sched, weekday: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2">
              {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input type="time" value={sched.start} onChange={(e) => setSched({ ...sched, start: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2" dir="ltr" />
            <span className="text-slate-400">إلى</span>
            <input type="time" value={sched.end} onChange={(e) => setSched({ ...sched, end: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2" dir="ltr" />
          </div>
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري الإنشاء..." : "إنشاء المجموعة"}</button>
        </form>
      </div>

      {groups === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل المجموعات...</div>
      ) : groups.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">لا توجد مجموعات بعد — أنشئ أول مجموعة من الأعلى.</div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id} className="card flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-small font-bold">{g.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {[g.grade_level, g.subject].filter(Boolean).join(" · ")}
                  {g.monthly_fee ? ` · ${g.monthly_fee} ج/شهر` : ""}
                  {` · ${g.students_count}${g.capacity > 0 ? `/${g.capacity}` : ""} طالب`}
                  {g.capacity > 0 && g.students_count >= g.capacity && (
                    <span className="mx-1 rounded-full bg-danger/10 px-2 py-0.5 font-bold text-danger">مكتملة 🔴</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <input value={capEdit[g.id] ?? ""} onChange={(e) => setCapEdit({ ...capEdit, [g.id]: e.target.value })}
                    placeholder={`السعة (${g.capacity || "∞"})`} inputMode="numeric" className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center" />
                  <button onClick={() => saveCap(g.id)} className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-500">حفظ</button>
                </div>
                {(g.schedule ?? []).length > 0 && (
                  <div className="mt-1 text-xs text-primary">
                    {(g.schedule ?? []).map((s: any, i: number) => (
                      <span key={i} className="me-2 rounded-full bg-primary-light px-2 py-0.5 font-bold">
                        {WEEKDAYS[Number(s.weekday)] ?? ""} {s.start}–{s.end}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => onDelete(g.id, g.name)} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/10">حذف</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
