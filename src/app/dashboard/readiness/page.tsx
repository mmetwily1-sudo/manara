"use client";

import { useEffect, useState } from "react";

type R = {
  rounds: { done: number; target: number; missing: number[] };
  migrations: number; api_routes: number; dashboard_pages: number;
  env: { supabase: boolean; gemini: boolean; cron: boolean; vapid: boolean };
};

/** لوحة الجاهزية: تقدم الـ 100 جولة + فحص البيئة */
export default function ReadinessPage() {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/readiness", { cache: "no-store" }).then(async (res) => {
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) setR(j);
      else if (res.status === 403) setErr("للمالك فقط.");
    }).catch(() => setErr("تعذر الاتصال."));
  }, []);

  if (err) return <div className="mx-auto max-w-3xl card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>;
  if (!r) return <div className="mx-auto max-w-3xl card p-6 text-center text-slate-400">جاري الفحص...</div>;
  const pct = Math.round((r.rounds.done / r.rounds.target) * 100);
  const envRows: [string, boolean][] = [
    ["Supabase", r.env.supabase], ["Gemini", r.env.gemini], ["Cron", r.env.cron], ["VAPID", r.env.vapid],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">جاهزية الإطلاق 🚀</h1>
        <p className="mt-1 text-small text-slate-500">تقدم الجولات + فحص البيئة</p>
      </header>
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">الجولات: {r.rounds.done} / {r.rounds.target}</h2>
          <span className="text-2xl font-extrabold text-primary" dir="ltr">{pct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100" dir="ltr">
          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
        </div>
        {r.rounds.missing.length > 0 ? (
          <div className="text-small text-warning">الناقص توثيقه: {r.rounds.missing.join("، ")}</div>
        ) : (
          <div className="text-small font-bold text-success">التوثيق كامل 100/100 ✅</div>
        )}
      </section>
      <section className="card grid grid-cols-3 gap-4 p-5 text-center">
        <div><div className="text-2xl font-extrabold">{r.migrations}</div><div className="text-xs text-slate-500">migration</div></div>
        <div><div className="text-2xl font-extrabold">{r.api_routes}</div><div className="text-xs text-slate-500">API route</div></div>
        <div><div className="text-2xl font-extrabold">{r.dashboard_pages}</div><div className="text-xs text-slate-500">صفحة لوحة</div></div>
      </section>
      <section className="card space-y-2 p-5">
        <h2 className="font-bold">البيئة</h2>
        {envRows.map(([label, ok]) => (
          <div key={label} className="flex items-center justify-between text-small">
            <span className="font-mono" dir="ltr">{label}</span>
            <span className={`font-bold ${ok ? "text-success" : "text-danger"}`}>{ok ? "متصل ✅" : "ناقص ⛔"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
