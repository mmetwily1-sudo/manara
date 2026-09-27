"use client";

import { useEffect, useState } from "react";

type L = { rank: number; medal: string | null; name: string; points: number };

/** لوحة منافسة المجموعات — أسماء مخفاة تلقائياً */
export default function LeaderboardPage() {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [gid, setGid] = useState("");
  const [leaders, setLeaders] = useState<L[] | null>(null);
  const [gname, setGname] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chs, setChs] = useState<{ id: string; title: string; target: number; group: string | null; deadline: string | null; status: string; top: { rank: number; name: string; points: number }[] }[]>([]);
  const [cform, setCform] = useState({ title: "", target: "100", group_id: "", deadline: "" });
  const [showC, setShowC] = useState(false);

  async function loadChs() {
    try {
      const r = await fetch("/api/challenges");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setChs(j.challenges);
    } catch {}
  }
  useEffect(() => { loadChs(); }, []);

  async function createCh(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/challenges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cform.title, target_points: Number(cform.target), group_id: cform.group_id || undefined, deadline: cform.deadline || undefined }),
      });
      if (r.ok) { setCform({ title: "", target: "100", group_id: "", deadline: "" }); setShowC(false); loadChs(); }
    } catch {}
    finally { setBusy(false); }
  }

  async function closeCh(id: string) {
    try {
      const r = await fetch("/api/challenges", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "closed" }),
      });
      if (r.ok) loadChs();
    } catch {}
  }

  useEffect(() => {
    fetch("/api/groups").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups((j.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
    }).catch(() => {});
  }, []);

  async function load(id: string) {
    setGid(id); setBusy(true);
    try {
      const r = await fetch(`/api/leaderboard${id ? `?group_id=${id}` : ""}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setLeaders(j.leaders); setGname(j.group); }
    } catch {}
    finally { setBusy(false); }
  }
  useEffect(() => { load(""); }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">لوحة المنافسة 🏆</h1>
          <p className="mt-1 text-small text-slate-500">متصدرو النقاط — الأسماء مخفاة حفاظاً على الخصوصية</p>
        </div>
        <select value={gid} onChange={(e) => load(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          <option value="">كل السنتر 🌍</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </header>
      <div className="card p-5">
        {busy || leaders === null ? (
          <div className="p-6 text-center text-slate-400">جاري التحميل...</div>
        ) : leaders.length === 0 ? (
          <div className="p-6 text-center text-small text-slate-500">لا نقاط بعد — تُمنح النقاط على الحضور والواجبات والامتحانات.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {leaders.map((l) => (
              <li key={l.rank} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 text-center text-xl">{l.medal ?? `#${l.rank}`}</span>
                  <span className="font-bold">{l.name}</span>
                </div>
                <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">{l.points} نقطة</span>
              </li>
            ))}
          </ul>
        )}
        {gname && <div className="mt-3 text-center text-xs text-slate-400">مجموعة: {gname}</div>}
      </div>

      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">تحديات المذاكرة ⚔️</h2>
          <button onClick={() => setShowC((v) => !v)} className="btn-secondary !px-3 !py-1.5 text-xs">{showC ? "إلغاء" : "تحدٍ جديد"}</button>
        </div>
        {showC && (
          <form onSubmit={createCh} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            <input value={cform.title} onChange={(e) => setCform({ ...cform, title: e.target.value })} required maxLength={120}
              placeholder="عنوان التحدي (مثال: سباق 200 نقطة قبل المراجعة)" className="rounded-xl border border-slate-200 px-4 py-2 sm:col-span-2" />
            <input value={cform.target} onChange={(e) => setCform({ ...cform, target: e.target.value })} type="number" min={10} placeholder="الهدف (نقاط)" className="rounded-xl border border-slate-200 px-4 py-2" />
            <input value={cform.deadline} onChange={(e) => setCform({ ...cform, deadline: e.target.value })} type="date" className="rounded-xl border border-slate-200 px-4 py-2" />
            <select value={cform.group_id} onChange={(e) => setCform({ ...cform, group_id: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-4 py-2 sm:col-span-2">
              <option value="">كل السنتر</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="btn-primary !py-2 text-small sm:col-span-2" disabled={busy}>إطلاق التحدي 🚀</button>
          </form>
        )}
        {chs.filter((c) => c.status === "open").map((c) => (
          <div key={c.id} className="rounded-xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold">{c.title} <span className="text-xs font-normal text-slate-400">الهدف {c.target} نقطة{c.group ? ` · ${c.group}` : ""}{c.deadline ? ` · حتى ${c.deadline}` : ""}</span></div>
              <button onClick={() => closeCh(c.id)} className="text-xs font-bold text-slate-400">إغلاق</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.top.map((t) => (
                <span key={t.rank} className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">
                  {t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : "🥉"} {t.name}: {t.points}
                </span>
              ))}
              {c.top.length === 0 && <span className="text-xs text-slate-400">لا متسابقين بعد.</span>}
            </div>
          </div>
        ))}
        {chs.filter((c) => c.status === "open").length === 0 && <div className="text-small text-slate-400">لا تحديات مفتوحة — أطلق أول تحدٍ بالأعلى.</div>}
      </section>
    </div>
  );
}
