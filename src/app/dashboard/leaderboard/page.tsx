"use client";

import { useEffect, useState } from "react";

type L = { rank: number; medal: string | null; name: string; points: number };

/** معركة مجموعتين في امتحان — المتوسط يحدد الفائز */
function BattleSection({ groups }: { groups: { id: string; name: string }[] }) {
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [f, setF] = useState({ exam_id: "", a: "", b: "" });
  const [out, setOut] = useState<{ exam: string; a: { name: string; count: number; avg: number | null }; b: { name: string; count: number; avg: number | null }; winner: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/exams").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setExams((j.exams ?? []).map((e: any) => ({ id: e.id, title: e.title })));
    }).catch(() => {});
  }, []);

  async function fight(e: React.FormEvent) {
    e.preventDefault();
    if (!f.exam_id || !f.a || !f.b || f.a === f.b) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/battles?exam_id=${f.exam_id}&a=${f.a}&b=${f.b}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setOut(j);
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">معركة المجموعات ⚔️ <span className="text-xs font-normal text-slate-400">متوسط الدرجات يحسم الفائز</span></h2>
      <form onSubmit={fight} className="grid gap-2 sm:grid-cols-4">
        <select value={f.exam_id} onChange={(e) => setF({ ...f, exam_id: e.target.value })} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
          <option value="">الامتحان…</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
          <option value="">المجموعة أ…</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={f.b} onChange={(e) => setF({ ...f, b: e.target.value })} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
          <option value="">المجموعة ب…</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button className="btn-primary !py-2 text-small" disabled={busy}>{busy ? "..." : "ابدأ المعركة ⚔️"}</button>
      </form>
      {out && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(["a", "b"] as const).map((k) => (
            <div key={k} className={`rounded-xl p-4 text-center ${out.winner === k ? "bg-success/10 ring-2 ring-success" : "bg-slate-50"}`}>
              <div className="font-bold">{out[k].name} {out.winner === k && "🏆"}</div>
              <div className="mt-1 text-2xl font-extrabold">{out[k].avg !== null ? `${out[k].avg}%` : "—"}</div>
              <div className="text-xs text-slate-400">{out[k].count} محاولة</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** لوحة شرف الأوائل — أعلى متوسط (3+ امتحانات) */
function OlympicsSection() {
  const [hall, setHall] = useState<{ rank: number; medal: string | null; name: string; avg: number; exams: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/olympics").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setHall(j.hall);
    }).catch(() => {});
  }, []);
  if (!hall || !hall.length) return null;
  return (
    <section className="card space-y-2 border-warning/25 bg-gradient-to-l from-warning/5 to-transparent p-5">
      <h2 className="font-bold">لوحة الشرف 🏛️ <span className="text-xs font-normal text-slate-400">أوائل السنتر — أعلى متوسط</span></h2>
      {hall.slice(0, 5).map((h) => (
        <div key={h.rank} className="flex items-center justify-between rounded-xl bg-white/60 px-4 py-2 text-small">
          <span className="font-bold">{h.medal ?? `#${h.rank}`} {h.name}</span>
          <span className="font-extrabold text-primary">{h.avg}% <span className="font-normal text-slate-400">({h.exams} امتحانات)</span></span>
        </div>
      ))}
    </section>
  );
}

/** سباق الواجبات الأسبوعي بين المجموعات (نسبة التسليم) */
function HwContest() {
  const [rows, setRows] = useState<{ id: string; name: string; members: number; submitted: number; rate: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/homework/contest").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setRows(j.contest);
    }).catch(() => {});
  }, []);
  if (!rows || !rows.length) return null;
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">سباق الواجبات الأسبوعي 📝 <span className="text-xs font-normal text-slate-400">نسبة التسليم لكل مجموعة</span></h2>
      {rows.slice(0, 5).map((r, i) => (
        <div key={r.id} className="flex items-center gap-2 text-small">
          <span className="w-8 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
          <span className="w-32 truncate font-bold">{r.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" dir="ltr">
            <div className={`h-full rounded-full ${i === 0 ? "bg-success" : "bg-primary"}`} style={{ width: `${r.rate}%` }} />
          </div>
          <span className="text-xs font-bold">{r.rate}% <span className="font-normal text-slate-400">({r.submitted}/{r.members})</span></span>
        </div>
      ))}
    </section>
  );
}

/** تنافس الفروع الشهري بالنقاط + منح نقاط (مالك) */
function BranchContest() {
  const [rows, setRows] = useState<{ id: string; name: string; points: number }[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({ branch_id: "", points: "", reason: "" });
  async function load(m: string) {
    try {
      const r = await fetch(`/api/branches/contest?month=${m}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setRows(j.rows); setIsOwner(!!j.isOwner); }
    } catch {}
  }
  useEffect(() => { load(month); }, [month]);
  async function award(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/branches/contest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch_id: form.branch_id, month, points: Number(form.points), reason: form.reason }),
    });
    if (r.ok) { setForm({ branch_id: "", points: "", reason: "" }); load(month); }
  }
  if (!rows || !rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <section className="card space-y-2 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">تنافس الفروع 🏆</h2>
        <input value={month} onChange={(e) => setMonth(e.target.value)} type="month"
          className="rounded-xl border border-slate-200 px-3 py-1 text-xs" dir="ltr" />
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2 text-small">
          <span className="w-8 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
          <span className="w-32 truncate font-bold">{r.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" dir="ltr">
            <div className={`h-full rounded-full ${i === 0 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.round((r.points / max) * 100)}%` }} />
          </div>
          <span className="text-xs font-bold">{r.points} نقطة</span>
        </div>
      ))}
      {isOwner && rows && (
        <form onSubmit={award} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} required
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value="">الفرع...</option>
            {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} placeholder="النقاط" required inputMode="numeric" dir="ltr"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="السبب" maxLength={200}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" />
          <button className="btn-primary !py-1.5 text-xs">منح 🏅</button>
        </form>
      )}
    </section>
  );
}

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

      <BattleSection groups={groups} />
      <OlympicsSection />
      <HwContest />
      <BranchContest />

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
