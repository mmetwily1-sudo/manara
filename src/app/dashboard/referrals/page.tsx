"use client";

import { useEffect, useState } from "react";

type Info = {
  code: string; link: string | null;
  stats: { pending: number; qualified: number; rewarded: number; earnedDays: number };
  referrals: { status: string; reward_days: number; referee: string | null; created_at: string; qualified_at: string | null; rewarded_at: string | null }[];
};

const ST: Record<string, [string, string]> = {
  pending: ["بانتظار أول اشتراك ⏳", "bg-slate-100 text-slate-500"],
  qualified: ["مؤهل — فترة حماية ✅", "bg-warning/10 text-warning"],
  rewarded: ["تمت المكافأة 🎉", "bg-success/10 text-success"],
  revoked: ["مرفوضة ⛔", "bg-danger/10 text-danger"],
};

/** لوحة متابعة الإحالات: القمع + كل مُحال وحالته + أدوات المشاركة */
export default function ReferralsPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/referrals").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setInfo(j);
      else setErr("تعذر التحميل.");
    }).catch(() => setErr("تعذر الاتصال."));
  }, []);

  function copy(txt: string) {
    navigator.clipboard?.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const waShare = info?.link
    ? `https://wa.me/?text=${encodeURIComponent(`جرّب منصة منارة لإدارة سنترك — وسجل من رابطي عشان نكسب معاً أيام مجانية 🎁\n${info.link}`)}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">الإحالات والنمو 📈</h1>
        <p className="mt-1 text-small text-slate-500">كل من يسجّل برابطك ويدفع يكسبك أياماً — تابعه هنا لحظة بلحظة</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {!info ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["مسجلون بدعوتك", info.stats.pending + info.stats.qualified + info.stats.rewarded, "primary"],
              ["بانتظار الدفع", info.stats.pending, "warning"],
              ["مكافآت مستلمة", info.stats.rewarded, "success"],
              ["أيام مكتسبة", info.stats.earnedDays, "primary"],
            ].map(([l, v]) => (
              <div key={l as string} className="card p-5 text-center">
                <div className="text-3xl font-extrabold text-primary">{v as number}</div>
                <div className="mt-1 text-small text-slate-500">{l}</div>
              </div>
            ))}
          </section>

          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <code className="flex-1 truncate rounded-xl bg-slate-50 px-4 py-2.5 font-mono text-small font-bold" dir="ltr">{info.link ?? info.code}</code>
            <div className="flex gap-2">
              <button onClick={() => copy(info.link ?? info.code)} className="btn-primary !px-4 !py-2 text-xs">{copied ? "✓ تم" : "نسخ الرابط"}</button>
              {waShare && <a href={waShare} target="_blank" rel="noreferrer" className="rounded-xl bg-success px-4 py-2 text-xs font-bold text-white">مشاركة واتساب 💬</a>}
              <a href="/referral" target="_blank" rel="noreferrer" className="btn-secondary !px-4 !py-2 text-xs">صفحة الشرح</a>
            </div>
          </section>

          <section className="card overflow-hidden">
            <table className="w-full text-right text-small">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>{["الزميل", "الحالة", "المكافأة", "التاريخ"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {info.referrals.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">لا إحالات بعد — شارك رابطك وابدأ النمو.</td></tr>
                ) : info.referrals.map((r, i) => {
                  const [label, tone] = ST[r.status] ?? [r.status, "bg-slate-100"];
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3 font-bold">{r.referee ?? "—"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span></td>
                      <td className="px-4 py-3 font-bold text-success">{r.status === "rewarded" ? `+${r.reward_days} يوم` : "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
