"use client";

import { useEffect, useState } from "react";

type Info = { trialDaysLeft: number | null; trialState: string; plan: string };

/** بانر التجربة: عدّاد حقيقي + زر تجديد عند النهاية (قرار اللجنة) */
export default function TrialBanner() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    fetch("/api/tenant/info").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && (j.trialState === "expiring" || j.trialState === "expired")) setInfo(j);
    }).catch(() => {});
  }, []);

  if (!info) return null;
  const expired = info.trialState === "expired";

  return (
    <section className={`card space-y-2 p-5 ${expired ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">{expired ? "⏳ انتهت فترتك التجريبية" : `⏳ تجربتك تنتهي خلال ${info.trialDaysLeft} أيام`}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {expired
              ? "سنترك محفوظ بالكامل — جدد اشتراكك لتكمل من حيث توقفت، مع ضمان استرداد 30 يوماً."
              : "جدد الآن ولا تفقد زخم سنترك — ضمان استرداد 30 يوماً بلا أسئلة."}
          </p>
        </div>
        <a href={expired ? "/pricing?plan=pro&expired=1" : "/pricing?plan=pro"} className="btn-primary shrink-0 text-small">{expired ? "جدد الآن ←" : `جدد (${info.trialDaysLeft} يوم متبقٍ)`}</a>
      </div>
    </section>
  );
}
