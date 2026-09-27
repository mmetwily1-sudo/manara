"use client";

import { useEffect, useState } from "react";

type Info = { trialDaysLeft: number | null; trialState: string; plan?: string; canExtend?: boolean };

/** بانر التجربة/الباقة: عدّاد + نفاد باقة مدفوعة + تمديد ذاتي مرة واحدة */
export default function TrialBanner() {
  const [info, setInfo] = useState<Info | null>(null);
  const [extending, setExtending] = useState(false);
  const [extended, setExtended] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/info").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return;
      if (j.trialState === "expiring" || j.trialState === "expired") setInfo(j);
      else if (j.trialState === "paid" && j.trialDaysLeft !== null && j.trialDaysLeft <= 7) setInfo(j);
    }).catch(() => {});
  }, []);

  async function extend() {
    if (extending) return;
    setExtending(true);
    try {
      const r = await fetch("/api/tenant/extend-trial", { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setExtended(true); setInfo(null); }
    } catch {}
    setExtending(false);
  }

  if (extended) {
    return (
      <section className="card border-success/30 bg-success/5 p-5">
        <div className="font-bold text-success">🎉 تم تمديد تجربتك 3 أيام — استغلها للنشر والتحصيل!</div>
      </section>
    );
  }
  if (!info) return null;
  const expired = info.trialState === "expired";
  const paidSoon = info.trialState === "paid";

  return (
    <section className={`card space-y-2 p-5 ${expired ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {paidSoon ? `⏳ باقتك (${info.plan}) تنتهي خلال ${info.trialDaysLeft} أيام`
              : expired ? "⏳ انتهت فترتك التجريبية"
              : `⏳ تجربتك تنتهي خلال ${info.trialDaysLeft} أيام`}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {paidSoon ? "جدد الآن قبل توقف التحصيل — بياناتك وسنترك محفوظان."
              : expired ? "سنترك محفوظ بالكامل — جدد اشتراكك لتكمل من حيث توقفت، مع ضمان استرداد 30 يوماً."
              : "جدد الآن ولا تفقد زخم سنترك — ضمان استرداد 30 يوماً بلا أسئلة."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {expired && info.canExtend && (
            <button onClick={extend} disabled={extending} className="btn-secondary text-small">
              {extending ? "جاري التمديد..." : "تمديد مجاني 3 أيام 🎁"}
            </button>
          )}
          <a href={expired ? "/pricing?plan=pro&expired=1" : "/pricing?plan=pro"} className="btn-primary text-small">
            {expired ? "جدد الآن ←" : paidSoon ? `جدد (${info.trialDaysLeft} يوم)` : `جدد (${info.trialDaysLeft} يوم متبقٍ)`}
          </a>
        </div>
      </div>
    </section>
  );
}
