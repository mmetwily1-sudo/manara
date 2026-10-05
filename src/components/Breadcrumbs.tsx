"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "لوحة المعلم",
  admin: "المالك",
  students: "الطلاب",
  attendance: "التحضير",
  payments: "التحصيل",
  invoices: "الفواتير",
  groups: "المجموعات",
  questions: "بنك الأسئلة",
  exams: "الامتحانات",
  videos: "الفيديوهات",
  assignments: "الواجبات",
  omr: "بابل شيت",
  announcements: "الإعلانات",
  store: "المتجر",
  certificates: "التقارير",
  digests: "تقارير الأهل",
  referrals: "الإحالات",
  staff: "الطاقم",
  messages: "الرسائل",
  notifications: "الإشعارات",
  reports: "التقارير",
  live: "اللايف",
  schedule: "الجدول",
  grades: "الدرجات",
  design: "التصميم",
  settings: "الإعدادات",
  billing: "الفوترة",
  impersonate: "المتابعة",
  tenants: "السناتر",
  feedback: "الصوت",
  dev: "المطور",
  team: "الفريق",
  payroll: "الرواتب",
  expenses: "المصروفات",
  transport: "المواصلات",
  forum: "المنتدى",
  goals: "الأهداف",
  projects: "المشاريع",
  notes: "المذكرات",
  library: "المكتبة",
  bookings: "الحجوزات",
  payments2: "المدفوعات",
};

/** فتات الخبز التلقائي — يعرف مكانك ويرجعك خطوة بخطوة */
export function Breadcrumbs() {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  let href = "";
  const crumbs = parts.map((p, i) => {
    href += `/${p}`;
    const isLast = i === parts.length - 1;
    const label = LABELS[p] ?? (/^[0-9a-f-]{8,}$/.test(p) ? "التفاصيل" : decodeURIComponent(p));
    return { href, label, isLast };
  });
  return (
    <nav aria-label="مسار التنقل" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>‹</span>}
          {c.isLast ? (
            <span className="font-bold text-slate-700">{c.label}</span>
          ) : (
            <Link href={c.href} className="font-bold text-primary hover:underline">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
