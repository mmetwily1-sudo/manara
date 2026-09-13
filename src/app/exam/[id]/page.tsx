"use client";

import { useEffect, useState } from "react";

type Q = { id: string; body: string; options: string[] | null; qtype: string };

export default function ExamPage({ params }: { params: { id: string } }) {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; certSerial: string | null } | null>(null);
  const [secLeft, setSecLeft] = useState(1800); // 30 دقيقة افتراضي

  useEffect(() => {
    // تحميل أسئلة الامتحان (مبسط: من API قادم — هنا demo)
    setTimeout(() => setQs([
      { id: "q1", body: "ما وحدة قياس القوة؟", options: ["نيوتن", "جول", "واط", "باسكال"], qtype: "mcq" },
      { id: "q2", body: "الجاذبية تتناسب عكسياً مع مربع المسافة.", options: ["صح", "خطأ"], qtype: "true_false" },
    ]), 400);
  }, [params.id]);

  useEffect(() => {
    const t = setInterval(() => setSecLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/exams/${params.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const j = await r.json();
      if (j.ok) setResult(j);
      else alert(j.error ?? "فشل التسليم");
    } finally { setSubmitting(false); }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6 text-center">
        <div className="text-h1">🎉</div>
        <h1 className="text-h1">نتيجتك: {result.score} / {result.total}</h1>
        {result.certSerial ? (
          <div className="card p-6">
            <p className="text-small text-slate-600">شهادتك جاهزة — رمز التحقق:</p>
            <div className="mt-2 font-mono text-h2 font-bold" dir="ltr">{result.certSerial}</div>
            <a href={`/verify/${result.certSerial}`} className="btn-primary mt-4 inline-block">عرض الشهادة</a>
          </div>
        ) : (
          <p className="text-small text-slate-500">حاول مرة أخرى لتحسين درجاتك والحصول على الشهادة.</p>
        )}
        <a href="/dashboard" className="btn-secondary inline-block">رجوع للوحة</a>
      </div>
    );
  }

  if (!qs) return <div className="p-8 text-center text-slate-400">جاري تحميل الامتحان...</div>;

  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-white p-3 shadow">
        <span className="font-mono text-h2 font-bold" dir="ltr">{mm}:{ss}</span>
        <span className="text-xs text-slate-500">{qs.length} أسئلة · حفظ تلقائي كل 10 ثواني</span>
        <button onClick={submit} disabled={submitting} className="btn-primary !px-5 !py-2 text-small">
          {submitting ? "جاري..." : "تسليم"}
        </button>
      </div>

      {qs.map((q, i) => (
        <div key={q.id} className="card p-5">
          <div className="text-small font-bold">{i + 1}. {q.body}</div>
          <div className="mt-3 space-y-2">
            {(q.options ?? []).map((opt) => (
              <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-small ${answers[q.id] === opt ? "border-primary bg-primary-light" : "border-slate-200"}`}>
                <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
