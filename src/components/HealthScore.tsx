"use client";

import { useEffect, useState } from "react";

type H = { score: number; grade: string; signals: string[] };

/** درجة صحة السنتر — بطاقة واحدة تلخص: اشتراك/تحصيل/تحضير/امتحانات */
export default function HealthScore() {
  const [h, setH] = useState<H | null>(null);

  useEffect(() => {
    fetch("/api/tenant/health").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setH(j);
    }).catch(() => {});
  }, []);

  if (!h) return null;
  const tone = h.score >= 80 ? "text-success" : h.score >= 55 ? "text-primary" : h.score >= 30 ? "text-warning" : "text-danger";
  const bar = h.score >= 80 ? "bg-success" : h.score >= 55 ? "bg-primary" : h.score >= 30 ? "bg-warning" : "bg-danger";

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">صحة سنترك ❤️‍🩹</h2>
        <div className={`text-2xl font-extrabold ${tone}`}>{h.score}<span className="text-xs font-normal text-slate-400">/100</span></div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" dir="ltr">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${h.score}%` }} />
      </div>
      <div className="text-small font-bold">{h.grade}</div>
      <ul className="space-y-1 text-xs text-slate-500">
        {h.signals.map((s, i) => <li key={i}>• {s}</li>)}
      </ul>
    </section>
  );
}
