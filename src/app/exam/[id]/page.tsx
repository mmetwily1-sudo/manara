"use client";

import { useEffect, useState } from "react";

type Q = { id: string; body: string; options: string[] | null; qtype: string; marks: number };

const ERROR_MESSAGES: Record<string, string> = {
  unauth: "سجّل دخولك أولاً لتتمكن من حل الامتحان.",
  exam_not_found: "الامتحان غير موجود — تأكد من الرابط أو تواصل مع معلمك.",
  forbidden: "هذا الامتحان يخص سنتراً آخر.",
  no_questions: "لا توجد أسئلة في هذا الامتحان بعد.",
  answers_required: "لم تصل أي إجابات — حاول مرة أخرى.",
  enroll_failed: "تعذر تسجيلك في السنتر — حاول مرة أخرى.",
  save_failed: "تعذر حفظ المحاولة — تحقق من الاتصال وحاول مجدداً.",
};

export default function ExamPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [qs, setQs] = useState<Q[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number; certSerial: string | null } | null>(null);
  const [secLeft, setSecLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/exams/${params.id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          setLoadError(ERROR_MESSAGES[j?.error] ?? "تعذر تحميل الامتحان — حاول مرة أخرى.");
          return;
        }
        setTitle(j.exam.title);
        setQs(j.questions);
        setSecLeft((j.exam.duration_minutes ?? 30) * 60);
      })
      .catch(() => setLoadError("تعذر الاتصال بالخادم — تحقق من الإنترنت."));
  }, [params.id]);

  useEffect(() => {
    if (secLeft === null) return;
    if (secLeft <= 0) { submit(); return; }
    const t = setInterval(() => setSecLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secLeft === null]);

  async function submit() {
    if (submitting || result) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/exams/${params.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) setResult(j);
      else setSubmitError(ERROR_MESSAGES[j?.error] ?? "فشل التسليم — حاول مرة أخرى.");
    } catch {
      setSubmitError("تعذر الاتصال بالخادم — تحقق من الإنترنت وحاول مجدداً.");
    } finally { setSubmitting(false); }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <div className="text-h1">😕</div>
        <p className="text-body font-bold">{loadError}</p>
        {loadError === ERROR_MESSAGES.unauth
          ? <a href="/login" className="btn-primary inline-block">تسجيل الدخول</a>
          : <a href="/dashboard" className="btn-secondary inline-block">رجوع للوحة</a>}
      </div>
    );
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

  if (!qs || secLeft === null) return <div className="p-8 text-center text-slate-400">جاري تحميل الامتحان...</div>;

  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-white p-3 shadow">
        <div className="text-right">
          <div className="text-small font-bold">{title}</div>
          <span className="font-mono text-h2 font-bold" dir="ltr">{mm}:{ss}</span>
        </div>
        <span className="text-xs text-slate-500">{qs.length} أسئلة</span>
        <button onClick={submit} disabled={submitting} className="btn-primary !px-5 !py-2 text-small">
          {submitting ? "جاري..." : "تسليم"}
        </button>
      </div>

      {submitError && (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm font-bold text-danger">{submitError}</div>
      )}

      {qs.length === 0 && (
        <div className="card p-8 text-center text-slate-500">لا توجد أسئلة في هذا الامتحان بعد.</div>
      )}

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
            {!q.options?.length && q.qtype === "short_answer" && (
              <input
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder="اكتب إجابتك هنا"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
