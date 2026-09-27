"use client";

import { useEffect, useState } from "react";

type Att = { id: string; student: string; score: number; answers: { q: string; body: string; marks: number; text: string }[] };

/** تصحيح المقالي: محاولات بأسئلة غير آلية + درجة يدوية معتمدة */
export default function GradingPage() {
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [eid, setEid] = useState("");
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState(0);
  const [atts, setAtts] = useState<Att[] | null>(null);
  const [noEssay, setNoEssay] = useState(false);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    fetch("/api/exams").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setExams((j.exams ?? []).map((e: any) => ({ id: e.id, title: e.title })));
    }).catch(() => {});
  }, []);

  async function load(id: string) {
    setEid(id); setAtts(null); setNoEssay(false);
    if (!id) return;
    try {
      const r = await fetch(`/api/grading?exam_id=${id}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setTitle(j.title); setTotal(j.total ?? 0);
        if (!j.essay) setNoEssay(true);
        else {
          setAtts(j.attempts);
          const m: Record<string, string> = {};
          j.attempts.forEach((a: Att) => { m[a.id] = String(a.score ?? 0); });
          setScores(m);
        }
      }
    } catch {}
  }

  async function save(a: Att) {
    setBusy(a.id);
    try {
      const r = await fetch("/api/grading", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: a.id, score: Number(scores[a.id]) }),
      });
      if (r.ok) load(eid);
    } catch {}
    finally { setBusy(""); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">تصحيح المقالي ✍️</h1>
          <p className="mt-1 text-small text-slate-500">الأسئلة غير الآلية فقط — الدرجة المعتمدة تحل محل الآلية</p>
        </div>
        <select value={eid} onChange={(e) => load(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          <option value="">اختر الامتحان…</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </header>

      {eid && noEssay && <div className="card p-6 text-center text-small text-slate-500">هذا الامتحان آلي التصحيح بالكامل ✅</div>}
      {atts !== null && !noEssay && atts.length === 0 && (
        <div className="card p-6 text-center text-small text-slate-500">لا محاولات بإجابات مقالية بعد.</div>
      )}
      {(atts ?? []).map((a) => (
        <section key={a.id} className="card space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{a.student}</span>
            <div className="flex items-center gap-2">
              <input value={scores[a.id] ?? ""} onChange={(e) => setScores({ ...scores, [a.id]: e.target.value })}
                type="number" min={0} max={total} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center font-bold" />
              <span className="text-xs text-slate-400">/ {total}</span>
              <button onClick={() => save(a)} disabled={busy === a.id} className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50">
                {busy === a.id ? "..." : "اعتماد"}
              </button>
            </div>
          </div>
          {a.answers.map((x) => (
            <div key={x.q} className="rounded-xl bg-slate-50 p-3 text-small">
              <div className="font-bold" dir="auto">{x.body} <span className="font-normal text-slate-400">({x.marks} درجات)</span></div>
              <div className="mt-1 leading-relaxed" dir="auto">{x.text}</div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
