"use client";

import { useEffect, useState } from "react";

type Pending = {
  id: string; subject: string; lesson: string | null; lesson_code: string | null;
  difficulty: number; qtype: string; body: string; options: string[] | null;
  correct_answer: string | null; marks: number; source: string | null;
  tenant_name: string; created_at: string;
};
type Data = {
  ok: boolean;
  stats: { sharedTotal: number; pendingCount: number; bySubject: Record<string, number>; gapsTotal: number };
  pending: Pending[];
  gaps: { track: string; subject: string; lesson: string; code: string }[];
};

export default function AdminBankPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/bank");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setData(j); setErr(""); }
      else setErr("تعذر التحميل — تأكد أن حسابك platform_admin.");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function review(id: string, action: "approve" | "reject") {
    if (!confirm(action === "approve" ? "اعتماد ونشر في البنك العام؟" : "رفض هذا السؤال؟")) return;
    setBusy(id);
    try {
      const r = await fetch("/api/admin/bank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) load();
      else setErr("فشلت المراجعة.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(null); }
  }

  if (err) return <div className="mx-auto max-w-md p-8 text-center font-bold text-danger">{err}</div>;
  if (!data) return <div className="p-8 text-center text-slate-400">جاري تحميل البنك المركزي...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">البنك المركزي 🌍</h1>
          <p className="mt-1 text-small text-slate-500">مراجعة مساهمات المعلمين + فجوات التغطية — انشر المحتوى الأصلي والرسمي فقط</p>
        </div>
        <a href="/admin" className="btn-secondary text-small">← الإدارة</a>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["أسئلة منشورة", data.stats.sharedTotal],
          ["بانتظار المراجعة", data.stats.pendingCount],
          ["مواد مغطاة", Object.keys(data.stats.bySubject).length],
          ["دروس بلا أسئلة", data.stats.gapsTotal],
        ].map(([l, v]) => (
          <div key={l as string} className="card p-4 text-center">
            <div className="text-h1 font-extrabold text-primary">{v}</div>
            <div className="mt-1 text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">طابور المراجعة ({data.pending.length})</h2>
        {data.pending.length === 0 ? (
          <p className="text-small text-slate-500">لا يوجد ما ينتظر — كل المساهمات تمت مراجعتها. 🎉</p>
        ) : (
          <ul className="space-y-3">
            {data.pending.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 p-4">
                <div className="text-small font-bold">{p.body}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{p.subject}</span><span>·</span><span>{p.qtype}</span>
                  <span>·</span><span>صعوبة {p.difficulty}</span>
                  <span>·</span><span>من: {p.tenant_name}</span>
                  {p.source && <><span>·</span><span>المصدر: {p.source}</span></>}
                </div>
                {Array.isArray(p.options) && (
                  <div className="mt-2 text-xs text-slate-600">الاختيارات: {p.options.join(" / ")}</div>
                )}
                {p.correct_answer && <div className="mt-1 text-xs font-bold text-success">الصحيحة: {p.correct_answer}</div>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => review(p.id, "approve")} disabled={busy === p.id}
                    className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">اعتماد ونشر ✅</button>
                  <button onClick={() => review(p.id, "reject")} disabled={busy === p.id}
                    className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger disabled:opacity-50">رفض</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">فجوات التغطية (دروس بلا أسئلة عامة)</h2>
        <p className="text-xs text-slate-500">وجّه صناعة المحتوى هنا أولاً — هذه الدروس لن يولّد منها شيء.</p>
        {data.gaps.length === 0 ? (
          <p className="text-small text-success">لا فجوات — كل الدروس مغطاة! 🎉</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-y-auto text-small">
            {data.gaps.map((g) => (
              <li key={g.code} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="font-bold">{g.lesson}</span>
                <span className="text-xs text-slate-500">{g.subject} · {g.track}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
