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
    setSid(id); setP(null); setBeh(null);
    if (!id) return;
    try {
      const r = await fetch(`/api/students/${id}/portfolio`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setP(j.portfolio);
    } catch {}
    loadBeh(id);
  }

  function copyCard() {
    const link = `${window.location.origin}/card/${sid}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const [beh, setBeh] = useState<{ notes: { id: string; kind: string; text: string; points: number; created_at: string }[]; negatives: number; level: string | null; suspended_until: string | null } | null>(null);
  const [note, setNote] = useState({ kind: "negative", text: "", points: "" });
  const [susUntil, setSusUntil] = useState("");

  async function loadBeh(id: string) {
    try {
      const r = await fetch(`/api/students/${id}/behavior`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setBeh(j); }
    } catch {}
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!sid || !note.text.trim()) return;
    try {
      const r = await fetch(`/api/students/${sid}/behavior`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(note),
      });
      if (r.ok) { setNote({ kind: "negative", text: "", points: "" }); loadBeh(sid); }
    } catch {}
  }

  async function suspend() {
    if (!sid) return;
    try {
      const r = await fetch(`/api/students/${sid}/suspend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until: susUntil || null }),
      });
      if (r.ok) { setSusUntil(""); loadBeh(sid); }
    } catch {}
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

          <section className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">السلوك والإنذارات ⚖️</h2>
              {beh?.level && (
                <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-bold text-danger">
                  إنذار {beh.level} ({beh.negatives} سلبية)
                </span>
              )}
              {beh?.suspended_until && (
                <span className="rounded-full bg-danger px-3 py-1 text-xs font-bold text-white">موقوف حتى {beh.suspended_until} ⛔</span>
              )}
            </div>
            <form onSubmit={addNote} className="flex flex-wrap gap-2">
              <select value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
                <option value="negative">سلبية 👎</option>
                <option value="positive">إيجابية 👍</option>
              </select>
              <input value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} maxLength={500}
                placeholder="نص الملاحظة السلوكية..." className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
              <input value={note.points} onChange={(e) => setNote({ ...note, points: e.target.value })} placeholder="±نقاط" inputMode="numeric" dir="ltr"
                title="نقاط تضاف/تخصم من رصيد الطالب (-20..20، فارغ=تلقائي)"
                className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-small" />
              <button className="btn-secondary !px-4 !py-2 text-xs">تسجيل</button>
            </form>
            {(beh?.notes ?? []).slice(0, 8).map((n) => (
              <div key={n.id} className="rounded-xl bg-slate-50 px-4 py-2 text-small">
                <span>{n.kind === "positive" ? "👍" : "👎"}</span> {n.text}
                {(n.points ?? 0) !== 0 && (
                  <span className={`mx-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${n.points > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`} dir="ltr">
                    {n.points > 0 ? `+${n.points}` : n.points}
                  </span>
                )}
                <span className="mx-2 text-xs text-slate-400">{String(n.created_at ?? "").slice(0, 10)}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <input value={susUntil} onChange={(e) => setSusUntil(e.target.value)} type="date" className="rounded-xl border border-slate-200 px-3 py-1.5 text-small" />
              <button onClick={suspend} className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger">
                {susUntil ? `إيقاف حتى ${susUntil}` : "فك الإيقاف"}
              </button>
              {p.phone && beh && beh.negatives > 0 && (
                <a
                  href={`https://wa.me/${String(p.phone).replace(/[^\d]/g, "")}?text=${encodeURIComponent(`تنبيه سلوكي من إدارة السنتر: نرجو التواصل العاجل بخصوص الطالب ${p.name} (إنذار ${beh.level ?? ""}) ⚠️`)}`}
                  target="_blank" rel="noreferrer" className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white"
                >
                  إنذار واتساب لولي الأمر 💬
                </a>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
