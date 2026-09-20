"use client";

import { useEffect, useRef, useState } from "react";

/**
 * بطاقة مراجعة مسودة ممسوحة (مستوى الوحدة — هوية ثابتة لا تُعاد إنشاؤها
 * مع كل render للأب، حتى لا تُمسح مدخلات المراجع أبداً).
 */
export function TeacherDraftCard({
  draft,
  onAct,
}: {
  draft: any;
  onAct: (id: string, action: "approve" | "delete", edits?: any) => void;
}) {
  const [body, setBody] = useState(draft.body ?? "");
  const [options, setOptions] = useState(((draft.options ?? []) as string[]).join("\n"));
  const [correct, setCorrect] = useState(draft.correct_answer ?? "");
  const [lesson, setLesson] = useState("");
  const [busy, setBusy] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionMsg, setVisionMsg] = useState("");
  const isManual = String(body ?? "").startsWith("[صفحة");
  // مزامنة لمرة واحدة: إذا مُلئت المسودة من الخادم (تفريغ تلقائي) بينما
  // الحقول المحلية ما زالت العنصر اليدوي الأصلي — اعرض النص الجديد.
  // لا تمس مدخلات كتبها المراجع بيده أبداً.
  const wasManual = useRef(String(draft.body ?? "").startsWith("[صفحة"));
  const synced = useRef(false);
  useEffect(() => {
    const serverBody = String(draft.body ?? "");
    if (!synced.current && wasManual.current && String(body).startsWith("[صفحة") && !serverBody.startsWith("[صفحة")) {
      synced.current = true;
      setBody(draft.body ?? "");
      setOptions(((draft.options ?? []) as string[]).join("\n"));
      if (draft.correct_answer) setCorrect(draft.correct_answer);
      setVisionMsg(
        draft.correct_answer
          ? "تم التفريغ والحل التلقائي ✅ — راجع الإجابة واعتمد."
          : "تم التفريغ التلقائي ✅ — اختر الإجابة الصحيحة واعتمد."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.body]);

  async function go(action: "approve" | "delete") {
    if (action === "delete" && !confirm("حذف هذه المسودة؟")) return;
    setBusy(true);
    try {
      await onAct(draft.id, action, {
        body,
        options: options.split("\n").map((s) => s.trim()).filter(Boolean),
        correct_answer: correct,
        lesson_code: lesson || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function retranscribe() {
    setVisionBusy(true); setVisionMsg("");
    try {
      const r = await fetch("/api/questions/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, action: "retranscribe" }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setBody(j.body ?? "");
        setOptions(((j.options ?? []) as string[]).join("\n"));
        setVisionMsg((j.options ?? []).length >= 2 ? "تم التفريغ التلقائي ✅ — راجع واعتمد." : "تم التفريغ — أكمل الاختيارات والإجابة ثم اعتمد.");
      } else setVisionMsg(j?.message ?? "فشل التفريغ: " + (j?.error ?? "خطأ غير معروف"));
    } catch {
      setVisionMsg("تعذر الاتصال بالخادم.");
    } finally {
      setVisionBusy(false);
    }
  }

  return (
    <li className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
      <div>
        <div className="mb-1 text-xs font-bold text-slate-500">
          الصورة الأصلية {draft.draft_page ? `(ص ${draft.draft_page})` : ""}
          {draft.exam_title ? ` · امتحان: ${draft.exam_title}` : ""}
        </div>
        {draft.page_url ? (
          <a href={draft.page_url} target="_blank" rel="noreferrer">
            <img src={draft.page_url} alt="صورة الورقة" className="max-h-80 w-full rounded-lg border object-contain" loading="lazy" />
          </a>
        ) : (
          <p className="text-xs text-slate-400">لا توجد صورة.</p>
        )}
      </div>
        <div className="space-y-2">
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary"
          />
          <textarea
            value={options} onChange={(e) => setOptions(e.target.value)} rows={3} dir="ltr" style={{ textAlign: "right" }}
            placeholder={"الاختيارات — سطر لكل اختيار، أو: أ) نص ب) نص ج) نص"}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary"
          />
          {options.split("\n").map((s) => s.trim()).filter(Boolean).length >= 2 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="w-full text-[11px] font-bold text-slate-500">اضغط الاختيار الصحيح:</span>
              {options.split("\n").map((s) => s.trim()).filter(Boolean).map((o) => (
                <button
                  key={o} type="button" onClick={() => setCorrect(o)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${correct === o ? "bg-success text-white" : "bg-slate-100 text-slate-600 hover:bg-success/20"}`}
                >
                  {o.length > 40 ? o.slice(0, 40) + "…" : o}
                </button>
              ))}
            </div>
          )}
          <input
            value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="الإجابة الصحيحة (أو اضغط أحد الاختيارات)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary"
          />
        <input
          value={lesson} onChange={(e) => setLesson(e.target.value.trim())} placeholder="كود الدرس (اختياري: phys-u1-l1)" dir="ltr"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-small outline-none focus:border-primary"
        />
        {isManual && (
          <div className="rounded-lg bg-primary-light/30 p-2 text-[11px] leading-relaxed text-slate-600">
            لم تُفرّغ هذه الصفحة آلياً بعد.
            <button onClick={retranscribe} disabled={visionBusy || busy}
              className="mr-1 rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50">
              {visionBusy ? "جاري التفريغ..." : "تفريغ تلقائي 👁️"}
            </button>
          </div>
        )}
        {visionMsg && <div className="text-[11px] font-bold text-success">{visionMsg}</div>}
        <div className="flex gap-2">
          <button onClick={() => go("approve")} disabled={busy} className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {busy ? "جاري..." : "اعتماد ✅"}
          </button>
          <button onClick={() => go("delete")} disabled={busy} className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger disabled:opacity-50">
            حذف
          </button>
        </div>
      </div>
    </li>
  );
}
