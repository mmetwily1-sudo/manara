"use client";

import { useState } from "react";

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
        <input
          value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="الإجابة الصحيحة (انسخ نص أحد الاختيارات)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary"
        />
        <input
          value={lesson} onChange={(e) => setLesson(e.target.value.trim())} placeholder="كود الدرس (اختياري: phys-u1-l1)" dir="ltr"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-small outline-none focus:border-primary"
        />
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
