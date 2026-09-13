"use client";

import { useEffect, useState } from "react";

type Q = { id: string; subject: string; lesson: string | null; difficulty: number; qtype: string; body: string; marks: number };

export default function QuestionsPage() {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [filter, setFilter] = useState({ subject: "", difficulty: "" });
  const [importing, setImporting] = useState(false);

  async function load() {
    const p = new URLSearchParams();
    if (filter.subject) p.set("subject", filter.subject);
    if (filter.difficulty) p.set("difficulty", filter.difficulty);
    const r = await fetch(`/api/questions?${p.toString()}`);
    const j = await r.json();
    setQs(j.questions ?? []);
  }
  useEffect(() => { load(); }, [filter]);

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

  const demo: Q[] = qs && qs.length > 0 ? qs : [
    { id: "d1", subject: "فيزياء", lesson: "الحركة", difficulty: 2, qtype: "mcq", body: "ما وحدة قياس القوة؟ $F=ma$", marks: 1 },
    { id: "d2", subject: "فيزياء", lesson: "نيوتن", difficulty: 3, qtype: "true_false", body: "الجاذبية تتناسب عكسياً مع مربع المسافة.", marks: 1 },
  ];

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
          <button className="btn-primary text-small">سؤال جديد</button>
        </div>
      </header>

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

      <ul className="space-y-3">
        {demo.map((q) => (
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
    </div>
  );
}
