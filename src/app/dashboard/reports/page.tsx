"use client";

import { useEffect, useState } from "react";

type G = { id: string; name: string; branch: string; teacher: string; students: number; expected: number; collected: number; outstanding: number; rate: number };
type B = { name: string; students: number; collected: number; outstanding: number };
type T = { name: string; groups: number; students: number; collected: number };

const fmt = (n: number) => `${Number(n).toLocaleString("ar-EG")} ج`;

/** تقارير الربحية: فرع/مجموعة/مدرس — آخر 30 يوماً */
export default function ReportsPage() {
  const [data, setData] = useState<{ total: number; branches: B[]; groups: G[]; teachers: T[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/reports/profitability").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setData(j);
      else setErr("تعذر التحميل — هذه الصفحة للمالك فقط.");
    }).catch(() => setErr("تعذر الاتصال."));
  }, []);

  if (err) return <div className="mx-auto max-w-5xl"><div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div></div>;
  if (!data) return <div className="mx-auto max-w-5xl"><div className="card p-8 text-center text-slate-400">جاري التحميل...</div></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">تقارير الربحية 💰</h1>
          <p className="mt-1 text-small text-slate-500">آخر 30 يوماً — إجمالي المحصّل <b className="text-success">{fmt(data.total)}</b></p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary text-small">طباعة 🖨️</button>
      </header>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">الفروع 🏢</h2>
        {data.branches.length === 0 ? <div className="text-small text-slate-400">لا فروع مسجلة.</div> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((b) => (
              <div key={b.name} className="rounded-xl bg-slate-50 p-4">
                <div className="font-bold">{b.name}</div>
                <div className="mt-1 text-small">محصّل: <b className="text-success">{fmt(b.collected)}</b></div>
                <div className="text-small">طلاب: <b>{b.students}</b> · متبقي: <b className="text-warning">{fmt(b.outstanding)}</b></div>
              </div>
            ))}
          </div>}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">المدرسون 👨‍🏫</h2>
        {data.teachers.length === 0 ? <div className="text-small text-slate-400">لا بيانات.</div> :
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.teachers.map((t) => (
              <div key={t.name} className="rounded-xl bg-slate-50 p-4">
                <div className="font-bold">{t.name}</div>
                <div className="mt-1 text-small">مجموعات: <b>{t.groups}</b> · طلاب: <b>{t.students}</b></div>
                <div className="text-small">محصّل: <b className="text-success">{fmt(t.collected)}</b></div>
              </div>
            ))}
          </div>}
      </section>

      <section className="card overflow-hidden">
        <h2 className="p-5 pb-2 font-bold">المجموعات 📚</h2>
        <table className="w-full text-right text-small">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{["المجموعة", "الفرع", "المدرس", "طلاب", "متوقع", "محصّل", "متبقي", "نسبة"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.groups.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-3 font-bold">{g.name}</td>
                <td className="px-4 py-3 text-slate-500">{g.branch}</td>
                <td className="px-4 py-3 text-slate-500">{g.teacher}</td>
                <td className="px-4 py-3">{g.students}</td>
                <td className="px-4 py-3">{fmt(g.expected)}</td>
                <td className="px-4 py-3 font-bold text-success">{fmt(g.collected)}</td>
                <td className="px-4 py-3 text-warning">{fmt(g.outstanding)}</td>
                <td className="px-4 py-3 font-bold">{g.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
