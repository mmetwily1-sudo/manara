"use client";

import { useEffect, useState } from "react";

type Rec = { id: string; kind: string; subject: string | null; topic: string | null; message: string; priority: number };

const KIND_ICON: Record<string, string> = {
  review_topic: "📘", at_risk_alert: "⚠️", celebrate_streak: "🎉", slow_down: "🐢", practice_more: "✍️",
};
const KIND_STYLE: Record<string, string> = {
  review_topic: "border-amber-200 bg-amber-50",
  at_risk_alert: "border-red-200 bg-red-50",
  celebrate_streak: "border-green-200 bg-green-50",
  slow_down: "border-slate-200 bg-slate-50",
  practice_more: "border-blue-200 bg-blue-50",
};

/** المدرّس الذكي — توصيات مبنية على أداء الطالب الفعلي (لا نصائح عامة) */
export function TutorRecommendations() {
  const [recs, setRecs] = useState<Rec[] | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/me/recommendations", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setRecs(j.recommendations ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function dismiss(id: string) {
    setRecs((prev) => (prev ?? []).filter((r) => r.id !== id));
    try {
      await fetch("/api/me/recommendations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
    } catch {}
  }

  if (recs === null) return null; // لسه بيحمّل — مفيش وميض فاضي
  if (recs.length === 0) return null; // مفيش توصيات حالياً = لا داعي لصندوق فاضي

  return (
    <div className="mb-6">
      <h2 className="mb-2 font-extrabold">🧠 المدرّس الذكي</h2>
      <div className="space-y-2">
        {recs.map((r) => (
          <div key={r.id} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${KIND_STYLE[r.kind] ?? "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-start gap-2">
              <span className="text-lg">{KIND_ICON[r.kind] ?? "💡"}</span>
              <p className="text-small">{r.message}</p>
            </div>
            <button onClick={() => dismiss(r.id)} className="shrink-0 text-xs text-slate-400 hover:text-slate-600" aria-label="إخفاء">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
