"use client";

import { useEffect, useState } from "react";

type Step = { key: string; title: string; desc: string; done: boolean; href: string; progress?: string };

/** قائمة التفعيل: 4 خطوات للحظة النجاح الأولى — تُخفى عند الاكتمال أو الإغلاق */
export default function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    fetch("/api/onboarding").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && !j.dismissed) {
        setSteps(j.steps);
        setDone(j.done ?? 0);
      }
    }).catch(() => {});
  }, []);

  async function dismiss() {
    try {
      await fetch("/api/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismiss: true }),
      });
    } catch {}
    setSteps(null);
  }

  async function confirmSite() {
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "site" }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        const r2 = await fetch("/api/onboarding", { cache: "no-store" });
        const j2 = await r2.json().catch(() => null);
        if (r2.ok && j2?.ok && !j2.dismissed) { setSteps(j2.steps); setDone(j2.done ?? 0); }
      }
    } catch {}
  }

  if (!steps || steps.every((s) => s.done)) {
    if (steps?.length && steps.every((s) => s.done)) {
      return (
        <section className="card border-success/25 bg-success/5 p-5 text-center">
          <div className="text-2xl">🎉</div>
          <p className="mt-1 text-small font-bold text-success">سنترك شغال بالكامل — تحضير وتحصيل وامتحانات! الخطوة الجاية: رشّح زميلاً من بطاقة الإحالة.</p>
        </section>
      );
    }
    return null;
  }

  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="card space-y-3 border-primary/25 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">🚀 جهّز سنترك في 10 دقائق ({done}/{steps.length})</h2>
        <button onClick={dismiss} className="text-xs text-slate-400 hover:text-slate-600">إخفاء</button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" dir="ltr">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <a href={s.done ? undefined : s.href} onClick={s.done ? (e) => e.preventDefault() : undefined}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${s.done ? "border-success/30 bg-success/5" : "border-slate-200 bg-white hover:border-primary"}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-small font-bold ${s.done ? "bg-success text-white" : "bg-slate-100 text-slate-500"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className="flex-1">
                <span className="block text-small font-bold">{s.title}</span>
                <span className="block text-xs text-slate-500">{s.desc}{s.progress && !s.done ? ` (${s.progress})` : ""}</span>
              </span>
              {!s.done && s.key === "site" && (
                <button onClick={(e) => { e.preventDefault(); confirmSite(); }}
                  className="shrink-0 rounded-lg bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                  تمت المعاينة ✓
                </button>
              )}
              {!s.done && <span className="text-xs font-bold text-primary">ابدأ ←</span>}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
