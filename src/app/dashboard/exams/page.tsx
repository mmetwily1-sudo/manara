"use client";

import { useEffect, useState } from "react";

type ExamRow = { id: string; title: string; duration_minutes: number; total_marks: number; is_published: boolean };

export default function ExamsListPage() {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/exams");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setExams(j.exams);
      else setListError(j?.error === "unauth" ? "سجّل دخولك أولاً." : "تعذر تحميل الامتحانات.");
    } catch {
      setListError("تعذر الاتصال بالخادم.");
    }
  }

  useEffect(() => { load(); }, []);

  async function onGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      title: fd.get("title"),
      distribution: { 1: Number(fd.get("easy") ?? 2), 2: Number(fd.get("mid") ?? 2), 3: Number(fd.get("hard") ?? 1) },
    };
    try {
      const r = await fetch("/api/exams/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { e.currentTarget.reset(); load(); }
      else alert(j?.error === "unauth" ? "سجّل دخولك أولاً." : `فشل التوليد: ${j?.error ?? "خطأ غير معروف"}`);
    } catch {
      alert("تعذر الاتصال بالخادم.");
    } finally { setGenerating(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الامتحانات</h1>
          <p className="mt-1 text-small text-slate-500">امتحانات بضغطة: اختر التوزيع واترك التوليد علينا</p>
        </div>
      </header>

      <div className="card p-6">
        <h2 className="font-bold">توليد امتحان جديد</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onGenerate}>
          <input name="title" placeholder="عنوان الامتحان" required className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <div className="flex gap-2 text-xs">
            <input name="easy" type="number" min={0} defaultValue={2} className="w-20 rounded-lg border px-2 py-2" /> سهل
            <input name="mid" type="number" min={0} defaultValue={2} className="w-20 rounded-lg border px-2 py-2" /> متوسط
            <input name="hard" type="number" min={0} defaultValue={1} className="w-20 rounded-lg border px-2 py-2" /> صعب
          </div>
          <button className="btn-primary sm:col-span-2" disabled={generating}>
            {generating ? "جاري التوليد..." : "توليد الآن"}
          </button>
        </form>
      </div>

      {listError ? (
        <div className="card p-8 text-center text-slate-500">{listError}</div>
      ) : exams === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الامتحانات...</div>
      ) : exams.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">لا توجد امتحانات بعد — ولّد أول امتحان من الأعلى.</div>
      ) : (
        <ul className="space-y-3">
          {exams.map((ex) => (
            <li key={ex.id} className="card flex items-center justify-between p-4">
              <div>
                <div className="text-small font-bold">{ex.title}</div>
                <div className="text-xs text-slate-500">{ex.duration_minutes} دقيقة{ex.total_marks ? ` · ${ex.total_marks} درجات` : ""}</div>
              </div>
              <a href={`/exam/${ex.id}`} className="btn-secondary !px-4 !py-1.5 text-xs">حل</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
