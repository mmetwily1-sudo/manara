"use client";

import { useEffect, useState } from "react";

/** بانر إطلاق الإحالة: يظهر بعد أول نجاح ملموس (امتحان منشور/تحصيل) — شرح + عرض افتتاحي */
export default function ReferralPromo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("manara.refpromo.dismissed.v1")) return;
    } catch {}
    Promise.all([
      fetch("/api/exams").then((r) => r.json().catch(() => null)),
      fetch("/api/referrals").then((r) => r.json().catch(() => null)),
    ]).then(([je, jr]) => {
      const hasSuccess = (je?.exams ?? []).some((e: any) => e.is_published);
      const hasReward = (jr?.stats?.rewarded ?? 0) > 0;
      if (hasSuccess && !hasReward) setShow(true);
    }).catch(() => {});
  }, []);

  function dismiss() {
    try { localStorage.setItem("manara.refpromo.dismissed.v1", "1"); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <section className="card space-y-2 border-warning/30 bg-gradient-to-l from-warning/10 to-transparent p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-bold">🎁 عرض الافتتاح: رشّح زميلاً واكسبا معاً 14 يوماً!</h2>
        <button onClick={dismiss} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
      </div>
      <p className="text-xs leading-relaxed text-slate-600">
        امتحانك الأول منشور — أنت جاهز تنمو: شارك رابط إحالتك، وكل زميل يسجّل ويدفع تكسب <b>أنت 14 يوماً وهو 7 أيام</b> (عرض الإطلاق حتى نهاية أكتوبر).
      </p>
      <a href="#referral" onClick={dismiss} className="btn-primary inline-block !py-2 text-small">انسخ رابطي الآن ←</a>
    </section>
  );
}
