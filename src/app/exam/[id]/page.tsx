"use client";

import { useEffect, useRef, useState } from "react";

type Q = { id: string; body: string; options: string[] | null; qtype: string; marks: number };

const ERROR_MESSAGES: Record<string, string> = {
  unauth: "سجّل دخولك أولاً لتتمكن من حل الامتحان.",
  exam_not_found: "الامتحان غير موجود — تأكد من الرابط أو تواصل مع معلمك.",
  forbidden: "هذا الامتحان يخص سنتراً آخر.",
  no_questions: "لا توجد أسئلة في هذا الامتحان بعد.",
  answers_required: "لم تصل أي إجابات — حاول مرة أخرى.",
  enroll_failed: "تعذر تسجيلك في السنتر — حاول مرة أخرى.",
  save_failed: "تعذر حفظ المحاولة — تحقق من الاتصال وحاول مجدداً.",
  code_required: "هذا الامتحان محمي بكود دخول — أدخل كودك الخاص.",
  bad_code: "الكود غير صحيح — تحقق منه وحاول مجدداً.",
  not_yours: "هذا الكود يخص طالباً آخر.",
  code_in_use: "الكود مستخدم على جهاز آخر — تواصل مع معلمك.",
  used: "هذا الكود استُخدم من قبل.",
  expired: "انتهت مدة الجلسة — تواصل مع معلمك.",
  revoked: "تم إلغاء هذا الكود — تواصل مع معلمك.",
  taken: "الكود قيد الاستخدام حالياً.",
  already_started: "لديك جلسة نشطة بالفعل.",
};

function deviceFp(): string {
  try {
    const s = [navigator.userAgent, screen.width + "x" + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "", navigator.language ?? ""].join("|");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "w" + h.toString(36);
  } catch { return "w0"; }
}

export default function ExamPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [qs, setQs] = useState<Q[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number; certSerial: string | null } | null>(null);
  const [secLeft, setSecLeft] = useState<number | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warned, setWarned] = useState(false);

  function load() {
    fetch(`/api/exams/${params.id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          if (j?.error === "code_required") { setNeedCode(true); setLoadError(null); return; }
          setLoadError(ERROR_MESSAGES[j?.error] ?? "تعذر تحميل الامتحان — حاول مرة أخرى.");
          return;
        }
        setNeedCode(false);
        setTitle(j.exam.title);
        setQs(j.questions);
        setSecLeft((j.exam.duration_minutes ?? 30) * 60);
      })
      .catch(() => setLoadError("تعذر الاتصال بالخادم — تحقق من الإنترنت."));
  }

  useEffect(() => { load(); }, [params.id]);

  // عدّاد تبديل التبويب: تحذير عند الأول + تسليم تلقائي عند الثالث (وضع آمن)
  const submitRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden || !qs) return;
      setWarned(true);
      setTabSwitches((n) => {
        const next = n + 1;
        if (next >= 3) setTimeout(() => submitRef.current?.(), 300);
        return next;
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qs]);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeBusy(true); setCodeErr("");
    try {
      const r = await fetch(`/api/exams/${params.id}/claim`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), device_fp: deviceFp() }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { load(); return; }
      setCodeErr(ERROR_MESSAGES[j?.error] ?? j?.message ?? "فشل تفعيل الكود.");
    } catch { setCodeErr("تعذر الاتصال بالخادم."); }
    finally { setCodeBusy(false); }
  }

  useEffect(() => {
    if (secLeft === null) return;
    if (secLeft <= 0) { submit(); return; }
    const t = setInterval(() => setSecLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secLeft === null]);

  useEffect(() => { submitRef.current = submit; });
  async function submit() {
    if (submitting || result) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/exams/${params.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, tabSwitches, device_fp: deviceFp() }),
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

  if (needCode) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8">
        <div className="card space-y-4 p-6 text-center">
          <div className="text-h1">🔐</div>
          <h1 className="font-bold">امتحان محمي بكود دخول</h1>
          <p className="text-small text-slate-500">أدخل الكود الخاص بك (6 رموز) — جلسة واحدة على جهازك.</p>
          {codeErr && <div className="rounded-xl bg-danger/10 px-4 py-2 text-sm font-bold text-danger">{codeErr}</div>}
          <form onSubmit={claim} className="flex gap-2" dir="ltr">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, "").slice(0, 6))}
              placeholder="••••••" maxLength={6}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center font-mono text-xl font-bold tracking-[0.3em] outline-none focus:border-primary" />
            <button disabled={codeBusy || code.length < 6} className="btn-primary shrink-0">{codeBusy ? "..." : "دخول"}</button>
          </form>
        </div>
      </div>
    );
  }

  if (!qs || secLeft === null) return <div className="p-8 text-center text-slate-400">جاري تحميل الامتحان...</div>;

  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {(warned || tabSwitches > 0) && (
        <div className={`rounded-xl px-4 py-2 text-center text-xs font-bold ${tabSwitches >= 2 ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
          {tabSwitches >= 3
            ? "⛔ تم تسليم امتحانك تلقائياً لتكرار مغادرة الصفحة (3 مرات)."
            : tabSwitches === 2
              ? "⛔ تحذير أخير: مغادرة أخرى = تسليم تلقائي."
              : `⚠️ غادرت صفحة الامتحان ${tabSwitches} ${tabSwitches === 1 ? "مرة" : "مرات"} — يُسجَّل ذلك في تقرير معلمك.`}
        </div>
      )}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-white p-3 shadow select-none">
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
