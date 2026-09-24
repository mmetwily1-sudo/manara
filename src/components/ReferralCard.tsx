"use client";

import { useEffect, useState } from "react";

type Info = {
  code: string; link: string | null;
  stats: { pending: number; qualified: number; rewarded: number; earnedDays: number };
  referrals: { status: string; reward_days: number; created_at: string }[];
};

const ST: Record<string, string> = {
  pending: "بانتظار أول اشتراك ⏳",
  qualified: "مؤهل — بانتظار فترة الحماية ✅",
  rewarded: "تمت المكافأة 🎉",
  revoked: "مرفوضة ⛔",
};

/** بطاقة الإحالة: رشّح زميلاً واكسب 7 أيام عن كل معلم يدفع ويستمر */
export default function ReferralCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setInfo(j);
    }).catch(() => {});
  }, []);

  if (!info) return null;

  function copy() {
    const txt = info!.link ?? info!.code;
    navigator.clipboard?.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <section className="card space-y-3 border-primary/20 bg-gradient-to-l from-primary-light/40 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">رشّح زميلاً واكسب 🎁</h2>
        <div className="flex gap-4 text-xs">
          <span>⏳ {info.stats.pending}</span>
          <span>✅ {info.stats.qualified}</span>
          <span>🎉 {info.stats.rewarded} ({info.stats.earnedDays} يوم)</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        شارك رابطك — تكسب <b>7 أيام اشتراك</b> عن كل زميل يسجّل ويدفع أول اشتراك ويستمر 14 يوماً (بحد 5 شهرياً).
      </p>
      <div className="flex items-center gap-2" dir="ltr">
        <code className="flex-1 truncate rounded-xl bg-white px-4 py-2.5 font-mono text-small font-bold shadow-sm">{info.link ?? info.code}</code>
        <button onClick={copy} className="btn-primary shrink-0 !px-4 !py-2 text-xs">{copied ? "✓ تم" : "نسخ الرابط"}</button>
      </div>
      {info.referrals.length > 0 && (
        <ul className="space-y-1 text-xs">
          {info.referrals.slice(0, 5).map((r, i) => (
            <li key={i} className="flex justify-between rounded-lg bg-white/70 px-3 py-1.5">
              <span className="text-slate-400">{new Date(r.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
              <span className="font-bold">{ST[r.status] ?? r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
