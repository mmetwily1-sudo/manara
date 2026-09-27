"use client";

import { useEffect, useState } from "react";

type Q = { body: string; options: string[] | null; correct: string | null; marks: number; qtype: string };

/** طباعة الامتحان + مفتاح الإجابات — نسخة ورقية من المنصة */
export default function ExamPrint({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [qs, setQs] = useState<Q[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/exams/${params.id}/print`).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setTitle(j.title); setQs(j.questions); }
      else setErr("تعذر التحميل.");
    }).catch(() => setErr("تعذر الاتصال."));
  }, [params.id]);

  if (err) return <div className="mx-auto max-w-3xl p-8 text-center text-danger">{err}</div>;
  if (!qs.length) return <div className="mx-auto max-w-3xl p-8 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-white p-6">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-small">
          <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
          إظهار مفتاح الإجابات
        </label>
        <div className="flex gap-2">
          <a href={`/api/export?scope=answerkey&exam_id=${params.id}`} className="btn-secondary !px-3 !py-1.5 text-xs">مفتاح CSV ⬇️</a>
          <button onClick={() => window.print()} className="btn-primary !px-4 !py-1.5 text-xs">طباعة 🖨️</button>
        </div>
      </div>
      <header className="border-b-2 border-slate-800 pb-3 text-center">
        <h1 className="text-h1 font-extrabold">{title}</h1>
        <p className="text-small text-slate-500">الاسم: .................... التاريخ: ..../..../........ الدرجة: ........</p>
      </header>
      <ol className="space-y-4">
        {qs.map((q, i) => (
          <li key={i} className="break-inside-avoid">
            <div className="font-bold">س{i + 1}: <span dir="auto">{q.body}</span> <span className="text-xs font-normal text-slate-400">({q.marks} درجات)</span></div>
            {Array.isArray(q.options) && q.options.length > 0 && (
              <ul className="mt-1 space-y-0.5 pr-6 text-small">
                {q.options.map((o, j) => (
                  <li key={j} dir="auto">({["أ", "ب", "ج", "د", "هـ"][j] ?? "•"}) {o}</li>
                ))}
              </ul>
            )}
            {q.qtype !== "mcq" && <div className="mt-2 h-16 rounded border border-slate-300" />}
            {showKey && q.correct && <div className="mt-1 text-small font-bold text-success">✓ الإجابة: <span dir="auto">{q.correct}</span></div>}
          </li>
        ))}
      </ol>
    </main>
  );
}
