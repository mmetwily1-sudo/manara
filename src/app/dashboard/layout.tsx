import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantInfoDB } from "@/lib/data";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { AuthGate, SignOutButton } from "@/components/AuthGate";
import { AgentWidget } from "@/components/AgentWidget";
import { MobileBottomNav } from "@/components/MobileNav";
import { SideNav } from "@/components/SideNav";
import { CommandPalette } from "@/components/CommandPalette";

const nav = [
  { href: "/dashboard", label: "الرئيسية", key: "01" },
  { href: "/dashboard/attendance", label: "التحضير", key: "02" },
  { href: "/dashboard/payments", label: "التحصيل", key: "03" },
  { href: "/dashboard/students", label: "الطلاب", key: "04" },
];

const navMore = [
  { href: "/dashboard/groups", label: "المجموعات والجدول", key: "05" },
  { href: "/dashboard/questions", label: "بنك الأسئلة", key: "06" },
  { href: "/dashboard/exams", label: "الامتحانات", key: "07" },
  { href: "/dashboard/videos", label: "الفيديوهات", key: "08" },
  { href: "/dashboard/assignments", label: "الواجبات", key: "08b" },
  { href: "/dashboard/omr", label: "بابل شيت OMR", key: "08c" },
  { href: "/dashboard/announcements", label: "الإعلانات", key: "08d" },
  { href: "/dashboard/store", label: "المتجر", key: "08e" },
  { href: "/dashboard/certificates", label: "التقارير", key: "09" },
  { href: "/dashboard/digests", label: "تقارير الأهل", key: "09b", roles: ["teacher_admin", "supervisor"] },
  { href: "/dashboard/referrals", label: "الإحالات والنمو", key: "09d", roles: ["teacher_admin"] },
  { href: "/dashboard/staff", label: "الفروع والطاقم", key: "09c", roles: ["teacher_admin"] },
  { href: "/dashboard/settings", label: "هويتي والإعدادات", key: "10", roles: ["teacher_admin"] },
  { href: "/dashboard/design", label: "تصميم الموقع", key: "10b", roles: ["teacher_admin"] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // الطالب لا يرى لوحة المعلم أبداً (بيانات الإيرادات والطلاب) — يُوجَّه لصفحة تقدمه
  // ملاحظة: redirect() يعمل برمي استثناء خاص — يجب أن يبقى خارج try/catch
  let viewerRole: string | null = null;
  try {
    const user = await getSessionUser();
    if (user) {
      const admin = adminClient();
      const { data: urow } = await admin
        .from("users")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();
      viewerRole = (urow as any)?.role ?? null;
    }
  } catch {}
  if (viewerRole === "student") redirect("/progress");
  const t = await getTenantInfoDB();
  if ((t as any)?.status && (t as any).status !== "active") redirect("/suspended");
  return (
    <AuthGate>
      <div className="min-h-screen bg-bg">
        <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-slate-100 bg-white lg:flex">
          <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg font-extrabold text-white" style={{ backgroundColor: t.color }}>ن</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-small font-bold leading-tight">{t.name}</div>
              <div className="text-xs text-slate-400">
                {(t as any).trialState === "paid" ? "باقة مدفوعة ✅"
                  : (t as any).trialState === "expired" ? "انتهت التجربة ⚠️"
                  : (t as any).trialState === "expiring" ? `تنتهي خلال ${(t as any).trialDaysLeft} أيام ⏳`
                  : (t as any).trialState === "active" ? `تجربة · متبقٍ ${(t as any).trialDaysLeft} يوم`
                  : "باقة تجريبية"}
              </div>
            </div>
            {(t as any).slug && (
              <a
                href={`/${(t as any).slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="عرض الموقع"
                aria-label="عرض الموقع"
                className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition hover:bg-primary-light"
              >
                <span aria-hidden>👁️</span>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                  عرض الموقع
                </span>
              </a>
            )}
          </div>
          <SideNav
            items={[...nav, ...navMore].filter((item: any) => !item.roles || !viewerRole || item.roles.includes(viewerRole) || viewerRole === "teacher_admin")}
          />
          <div className="space-y-2 border-t border-slate-100 p-4">
            <CommandPalette />
            <a href="#" className="block rounded-lg bg-slate-50 px-3 py-2.5 text-center text-small font-bold text-slate-600 transition hover:bg-slate-100">الدعم الفني على واتساب</a>
            <SignOutButton className="block w-full text-center text-xs font-semibold text-slate-400 transition hover:text-danger" />
          </div>
        </aside>

        <div className="lg:mr-64">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-100 bg-white/90 px-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ backgroundColor: t.color }}>ن</span>
              <span className="font-bold">{t.name}</span>
            </div>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">تجربة</span>
            <CommandPalette />
          </header>

          <main className="px-4 pb-24 pt-6 md:px-8 lg:pb-10">{children}</main>
        </div>

        <MobileBottomNav
          main={nav}
          more={[...navMore].filter((item: any) => !item.roles || !viewerRole || item.roles.includes(viewerRole) || viewerRole === "teacher_admin")}
        />
        <AgentWidget />
      </div>
    </AuthGate>
  );
}
