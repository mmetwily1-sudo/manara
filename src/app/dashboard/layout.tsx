import Link from "next/link";
import { getTenantInfoDB } from "@/lib/data";
import { AuthGate, SignOutButton } from "@/components/AuthGate";

const nav = [
  { href: "/dashboard", label: "الرئيسية", key: "01" },
  { href: "/dashboard/attendance", label: "التحضير", key: "02" },
  { href: "/dashboard/payments", label: "التحصيل", key: "03" },
  { href: "/dashboard/students", label: "الطلاب", key: "04" },
];

const navMore = [
  { href: "#", label: "المجموعات والجدول", key: "05" },
  { href: "#", label: "بنك الأسئلة", key: "06" },
  { href: "#", label: "الامتحانات", key: "07" },
  { href: "#", label: "الفيديوهات", key: "08" },
  { href: "#", label: "التقارير", key: "09" },
  { href: "#", label: "هويتي والإعدادات", key: "10" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getTenantInfoDB();
  return (
    <AuthGate>
      <div className="min-h-screen bg-bg">
        <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-slate-100 bg-white lg:flex">
          <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg font-extrabold text-white" style={{ backgroundColor: t.color }}>ن</span>
            <div>
              <div className="text-small font-bold leading-tight">{t.name}</div>
              <div className="text-xs text-slate-400">باقة تجريبية · 7 أيام</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {[...nav, ...navMore].map((item) => (
              <Link key={item.label} href={item.href}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-small font-semibold text-slate-600 transition hover:bg-primary-light/50 hover:text-primary">
                <span>{item.label}</span>
                <span className="font-mono text-[11px] text-slate-300 transition group-hover:text-primary">{item.key}</span>
              </Link>
            ))}
          </nav>
          <div className="space-y-2 border-t border-slate-100 p-4">
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
          </header>

          <main className="px-4 pb-24 pt-6 md:px-8 lg:pb-10">{children}</main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white lg:hidden">
          {nav.map((item) => (
            <Link key={item.label} href={item.href}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-slate-500 transition active:bg-slate-50">
              <span aria-hidden className="text-base leading-none">·</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </AuthGate>
  );
}
