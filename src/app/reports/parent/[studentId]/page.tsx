"use client";

import { useEffect, useState } from "react";

type Report = {
  center: string;
  student: { name: string; phone: string | null };
  period: { from: string; to: string };
  attendance: { present: number; total: number; pct: number | null };
  exams: { count: number; avg_score: number | null; list: { title: string; score: number; date: string }[] };
  payments: { paid: number; expected: number; outstanding: number };
};

export default function ParentReportPage({ params }: { params: { studentId: string } }) {
  const [rep, setRep] = useState<Report | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/reports/parent?studentId=${params.studentId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) setRep(j.report);
        else setErr("تعذر تحميل التقرير — تأكد من صلاحياتك.");
      })
      .catch(() => setErr("تعذر الاتصال بالخادم."));
  }, [params.studentId]);

  if (err) return <div className="mx-auto max-w-md p-8 text-center font-bold text-danger">{err}</div>;
  if (!rep) return <div className="mx-auto max-w-md p-8 text-center text-slate-400">جاري تجهيز التقرير...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 bg-white p-6 print:max-w-none print:p-0">
      <style>{`@media print { body * { visibility: hidden; } #parent-report, #parent-report * { visibility: visible; } #parent-report { position: absolute; inset: 0; } .no-print { display: none !important; } }`}</style>
      <div id="parent-report" className="space-y-5" dir="rtl">
        <header className="border-b-2 border-primary pb-4 text-center">
          <h1 className="text-h1 font-extrabold">{rep.center}</h1>
          <p className="mt-1 text-small text-slate-500">التقرير الشهري لولي الأمر — {rep.period.from} إلى {rep.period.to}</p>
          <p className="mt-2 text-body font-bold">الطالب: {rep.student.name}</p>
        </header>

        <section className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border p-3">
            <div className="text-h2 font-extrabold text-primary">{rep.attendance.pct ?? "—"}{rep.attendance.pct !== null && "%"}</div>
            <div className="text-xs text-slate-500">الحضور ({rep.attendance.present}/{rep.attendance.total})</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-h2 font-extrabold text-primary">{rep.exams.avg_score ?? "—"}</div>
            <div className="text-xs text-slate-500">متوسط الدرجات ({rep.exams.count} امتحان)</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-h2 font-extrabold text-primary">{rep.payments.outstanding}</div>
            <div className="text-xs text-slate-500">المتبقي (جنيه)</div>
          </div>
        </section>

        {rep.exams.list.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">نتائج الامتحانات</h2>
            <table className="w-full text-small">
              <thead><tr className="border-b text-slate-500"><th className="py-2 text-right">الامتحان</th><th>الدرجة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {rep.exams.list.map((e, i) => (
                  <tr key={i} className="border-b"><td className="py-2 font-bold">{e.title}</td><td className="text-center">{e.score}</td><td className="text-center text-slate-500">{e.date}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="rounded-xl bg-slate-50 p-4 text-small">
          <div className="flex justify-between"><span>المدفوع هذا الشهر</span><b>{rep.payments.paid} جنيه</b></div>
          <div className="mt-1 flex justify-between"><span>المطلوب</span><b>{rep.payments.expected} جنيه</b></div>
          <div className="mt-1 flex justify-between font-bold text-primary"><span>المتبقي</span><b>{rep.payments.outstanding} جنيه</b></div>
        </section>
      </div>

      <div className="no-print flex gap-2">
        <button onClick={() => window.print()} className="btn-primary flex-1">🖨️ طباعة / حفظ PDF</button>
        <a href="/dashboard/students" className="btn-secondary">رجوع للطلاب</a>
      </div>
    </div>
  );
}
