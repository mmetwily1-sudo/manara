import Link from "next/link";
import { getKpis, getGroups, getEarlyWarning, getFeed } from "@/lib/data";
import ReferralCard from "@/components/ReferralCard";
import ReferralPromo from "@/components/ReferralPromo";
import NpsBanner from "@/components/NpsBanner";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import FeedbackWidget from "@/components/FeedbackWidget";

export default async function DashboardHome() {
  const [kpis, groups, warnings, feed] = await Promise.all([getKpis(), getGroups(), getEarlyWarning(), getFeed()]);
  const todayStr = new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">يومك في شاشة واحدة</h1>
          <p className="mt-1 text-small text-slate-500">{todayStr} — {groups.length} {groups.length === 1 ? "جلسة" : "جلسات"} النهاردة</p>
        </div>
        <Link href="/dashboard/attendance" className="btn-primary text-small">ابدأ التحضير</Link>
      </header>

      {/* KPIs — أرقام ضخمة (نمط حاضر) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["حاضرين النهاردة", kpis.presentToday, "success"],
          ["غايبين", kpis.absentToday, "danger"],
          ["محصّل الشهر ده", `${kpis.collectedMonth.toLocaleString("ar-EG")} ج`, "primary"],
          ["متأخرات", `${kpis.outstanding.toLocaleString("ar-EG")} ج`, "warning"],
        ].map(([label, value, tone]) => (
          <div key={label as string} className="card p-5">
            <div
              className={`text-3xl font-extrabold ${
                tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-primary"
              }`}
            >
              {value}
            </div>
            <div className="mt-1 text-small text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      <OnboardingChecklist />
      <NpsBanner />
      <ReferralPromo />
      <ReferralCard />
      <FeedbackWidget />

      {/* إنذار مبكر */}
      {warnings.length > 0 && (
        <section className="card border-warning/25 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-warning">إنذار مبكر — طلاب معرضين للتسرّب</h2>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">{warnings.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {warnings.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-small font-bold">{w.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{w.detail}</div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{w.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* جلسات النهاردة */}
        <section>
          <h2 className="mb-4 font-bold">جلسات النهاردة</h2>
          {groups.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-small text-slate-500">لا توجد مجموعات بعد</p>
              <p className="mt-1 text-xs text-slate-400">أنشئ مجموعتك الأولى من الإعدادات لبدء التحضير</p>
              <Link href="/dashboard/groups" className="btn-secondary mt-3 inline-block !px-4 !py-1.5 text-xs">إضافة مجموعة</Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.id} className="card flex items-center justify-between p-4">
                  <div>
                    <div className="text-small font-bold">{g.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{g.grade} · {g.subject}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">{g.todaySlot}</span>
                    <Link href="/dashboard/attendance" className="btn-secondary !px-4 !py-1.5 text-xs">تحضير</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Feed آخر الأحداث */}
        <section>
          <h2 className="mb-4 font-bold">آخر الأحداث</h2>
          {feed.length === 0 ? (
            <div className="card p-8 text-center text-small text-slate-400">لا توجد أحداث بعد — سجل حضورك الأول وستظهر هنا</div>
          ) : (
            <ul className="card divide-y divide-slate-100">
              {feed.map((e) => (
                <li key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-small font-bold">{e.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{e.detail}</div>
                    </div>
                    <span className="whitespace-nowrap text-[11px] text-slate-400">{e.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
