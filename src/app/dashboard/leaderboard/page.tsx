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
    </div>
  );
}
