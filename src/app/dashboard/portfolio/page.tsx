"use client";

import { useEffect, useState } from "react";

type P = {
  name: string; phone: string | null; points: number; present30: number; absent30: number; avg5: number | null;
  groups: string[]; attempts: { exam: string; score: number; at: string }[];
  certificates: { id: string; title: string; serial_code: string; issued_at: string }[];
  goals: { title: string; status: string }[];
};

/** ملف إنجاز الطالب — كل تاريخه التعليمي في شاشة + روابط بطاقته */
export default function PortfolioPage() {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [sid, setSid] = useState("");
  const [p, setP] = useState<P | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/students").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setStudents((j.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, []);

  async function load(id: string) {
    setSid(id); setP(null);
    if (!id) return;
    try {
      const r = await fetch(`/api/students/${id}/portfolio`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setP(j.portfolio);
    } catch {}
  }

  function copyCard() {
    const link = `${window.location.origin}/card/${sid}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">ملف الإنجاز 🎓</h1>
          <p className="mt-1 text-small text-slate-500">حضور ودرجات وشهادات وأهداف — وبطاقته الرقمية للمشاركة</p>
        </div>
        <div className="flex gap-2">
          <select value={sid} onChange={(e) => load(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
            <option value="">اختر الطالب…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {sid && <button onClick={copyCard} className="btn-secondary !px-4 !py-2 text-xs">{copied ? "✓ تم" : "رابط البطاقة 🪪"}</button>}
        </div>
      </header>

      {!sid ? (
        <div className="card p-8 text-center text-slate-400">اختر طالباً لعرض ملفه.</div>
      ) : !p ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : (
        <>
          <section className="card grid gap-4 p-5 text-center sm:grid-cols-4">
            {[
              ["النقاط ⭐", p.points],
              ["حضور 30 يوم ✅", p.present30],
              ["غياب 30 يوم ⚠️", p.absent30],
              ["متوسط آخر 5 📝", p.avg5 !== null ? `${p.avg5}%` : "—"],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="text-2xl font-extrabold text-primary">{v}</div>
                <div className="mt-1 text-xs text-slate-500">{l}</div>
              </div>
            ))}
          </section>
          <section className="card space-y-2 p-5">
            <h2 className="font-bold">{p.name}</h2>
            <div className="text-xs text-slate-500">مجموعات: {p.groups.join(" · ") || "—"}</div>
            {p.attempts.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {p.attempts.slice(0, 6).map((a, i) => (
                  <span key={i} className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">{a.exam}: {a.score}</span>
                ))}
              </div>
            )}
            {p.certificates.length > 0 && (
              <div className="pt-1">
                <div className="text-xs font-bold text-slate-500">الشهادات 🎓</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {p.certificates.map((c) => (
                    <a key={c.id} href={`/verify/${c.serial_code}`} target="_blank" rel="noreferrer" className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">{c.title}</a>
                  ))}
                </div>
              </div>
            )}
            {p.goals.length > 0 && (
              <div className="pt-1 text-xs text-slate-500">
                الأهداف: {p.goals.filter((g) => g.status === "done").length}/{p.goals.length} منجزة 🎯
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
