"use client";

import { useEffect, useState } from "react";

/** استيراد درجات ورقية: الصق (اسم/هاتف ثم الدرجة) سطراً بسطر — لا يخفض درجة أونلاين أعلى */
export default function GradesPage() {
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [examId, setExamId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; missing: string[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/exams").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setExams((j.exams ?? []).map((e: any) => ({ id: e.id, title: e.title })));
    }).catch(() => {});
  }, []);

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!examId || !text.trim()) return;
    setBusy(true); setErr(""); setResult(null);
    try {
      const rows = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [student, score] = l.split(/[,،\t]/).map((s) => s.trim());
        return { student, score: Number(score) };
      }).filter((r) => r.student);
      const r = await fetch("/api/grades/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_id: examId, rows }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setResult(j); setText(""); }
      else setErr("فشل الاستيراد: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">استيراد الدرجات 📥</h1>
          <p className="mt-1 text-small text-slate-500">درجات الورقي إلى المنصة في دقيقة — سطر لكل طالب: الاسم، الدرجة</p>
        </div>
        <a href={`/api/export?scope=grades${examId ? `&exam_id=${examId}` : ""}`} className="btn-secondary text-small">تصدير الدرجات CSV ⬇️</a>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {result && (
        <div className="card border-success/30 bg-success/5 p-4 text-small font-bold text-success">
          تم استيراد {result.imported} درجة ✅
          {result.missing.length > 0 && <div className="mt-1 font-normal text-warning">أسماء لم تُطابق: {result.missing.join("، ")}</div>}
        </div>
      )}
      <form onSubmit={onImport} className="card space-y-3 p-5">
        <select value={examId} onChange={(e) => setExamId(e.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <option value="">اختر الامتحان…</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="auto"
          placeholder={"أحمد محمد، 45\nمنى علي، 38\n01001234567، 42"} className="input w-full font-mono" />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "جاري الاستيراد..." : "استيراد الدرجات"}</button>
      </form>
    </div>
  );
}
