"use client";

import { useEffect, useState } from "react";

type Q = { id: string; subject: string; lesson: string | null; difficulty: number; qtype: string; body: string; marks: number };

export default function QuestionsPage() {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [filter, setFilter] = useState({ subject: "", difficulty: "" });
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ body: "", subject: "", lesson: "", difficulty: "2", qtype: "mcq", options: "", correct: "", marks: "1" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const p = new URLSearchParams();
      if (filter.subject) p.set("subject", filter.subject);
      if (filter.difficulty) p.set("difficulty", filter.difficulty);
      const r = await fetch(`/api/questions?${p.toString()}`);
      const j = await r.json().catch(() => null);
      setQs(r.ok && j?.ok ? (j.questions ?? []) : []);
      if (!r.ok) setErr("تعذر تحميل الأسئلة.");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, [filter]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const options = form.options.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const r = await fetch("/api/questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: form.body, subject: form.subject || "عام", lesson: form.lesson || null,
          difficulty: Number(form.difficulty) || 2, qtype: form.qtype,
          options: options.length ? options : null,
          correct_answer: form.correct || null, marks: Number(form.marks) || 1,
        }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ body: "", subject: "", lesson: "", difficulty: "2", qtype: "mcq", options: "", correct: "", marks: "1" });
        setShowAdd(false);
        load();
      } else setErr("فشل الحفظ: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    const fd = new FormData(); fd.set("file", f);
    const r = await fetch("/api/questions/import", { method: "POST", body: fd });
    const j = await r.json();
    alert(j.ok ? `تم استيراد ${j.imported} سؤال (تخطي ${j.skipped})` : j.error);
    setImporting(false); load();
  }



  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">بنك الأسئلة</h1>
          <p className="mt-1 text-small text-slate-500">أسئلتك بمعادلات KaTeX وإستيراد Excel/CSV</p>
        </div>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer text-small">
            {importing ? "جاري..." : "استيراد Excel/CSV"}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} disabled={importing} />
          </label>
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-small">سؤال جديد</button>
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {showAdd && (
        <form onSubmit={onAdd} className="card grid gap-3 p-5 sm:grid-cols-2">
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="نص السؤال (يدعم $LaTeX$)" required rows={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="المادة" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <input value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} placeholder="الدرس (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <select value={form.qtype} onChange={(e) => setForm({ ...form, qtype: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <option value="mcq">اختيار من متعدد</option>
            <option value="true_false">صح / خطأ</option>
            <option value="short_answer">إجابة قصيرة</option>
          </select>
          <div className="flex items-center gap-2">
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
              <option value="1">1 سهل</option>
              <option value="2">2 متوسط</option>
              <option value="3">3 صعب</option>
            </select>
            <input value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} placeholder="الدرجات" inputMode="decimal" className="w-24 rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          </div>
          <textarea value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="الاختيارات — سطر لكل اختيار (لـ mcq)" rows={3} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" dir="ltr" style={{ textAlign: "right" }} />
          <input value={form.correct} onChange={(e) => setForm({ ...form, correct: e.target.value })} placeholder="الإجابة الصحيحة (نص مطابق لأحد الاختيارات)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ السؤال"}</button>
        </form>
      )}

      <div className="card flex flex-wrap gap-2 p-3 text-xs">
        <input placeholder="المادة" value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-1.5 outline-none" />
        <select value={filter.difficulty} onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-1.5">
          <option value="">كل المستويات</option>
          <option value="1">1 سهل</option>
          <option value="2">2 متوسط</option>
          <option value="3">3 صعب</option>
        </select>
        <span className="ml-auto text-slate-400">القالب: subject | lesson | difficulty | qtype | body | options | correct_answer | marks</span>
      </div>

      {qs === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الأسئلة...</div>
      ) : qs.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا توجد أسئلة بعد — أضف أول سؤال بالزر بالأعلى أو استورد ملف Excel.</div>
      ) : (
      <ul className="space-y-3">
        {qs.map((q) => (
          <li key={q.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-small font-bold">{q.body}</div>
              <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-bold text-primary">صعوبة {q.difficulty} · {q.marks} درجات</span>
            </div>
            <div className="mt-2 flex gap-2 text-xs text-slate-500">
              <span>{q.subject}</span>
              {q.lesson && <><span>·</span><span>{q.lesson}</span></>}
              <span>·</span><span>{q.qtype}</span>
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
