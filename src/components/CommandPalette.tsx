"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Entry = { href: string; label: string; keys: string; icon: string };

const INDEX: Entry[] = [
  { href: "/dashboard", label: "الرئيسية", keys: "رئيسية home", icon: "🏠" },
  { href: "/dashboard/attendance", label: "التحضير", keys: "حضور غياب تحضير qr", icon: "✅" },
  { href: "/dashboard/payments", label: "التحصيل", keys: "فلوس دفع تحصيل خزنة", icon: "💰" },
  { href: "/dashboard/students", label: "الطلاب", keys: "طالب طلاب", icon: "🎓" },
  { href: "/dashboard/groups", label: "المجموعات والجدول", keys: "مجموعة جدول حصص", icon: "🗓️" },
  { href: "/dashboard/questions", label: "بنك الأسئلة", keys: "اسئلة بنك", icon: "❓" },
  { href: "/dashboard/exams", label: "الامتحانات", keys: "امتحان اونلاين", icon: "📝" },
  { href: "/dashboard/videos", label: "الفيديوهات", keys: "فيديو حصص مسجلة", icon: "🎬" },
  { href: "/dashboard/assignments", label: "الواجبات", keys: "واجب", icon: "📚" },
  { href: "/dashboard/omr", label: "بابل شيت", keys: "omr تصحيح", icon: "⭕" },
  { href: "/dashboard/announcements", label: "الإعلانات", keys: "اعلان", icon: "📢" },
  { href: "/dashboard/store", label: "المتجر", keys: "متجر بيع مذكرات", icon: "🛍️" },
  { href: "/dashboard/certificates", label: "التقارير", keys: "شهادات تقارير", icon: "🎓" },
  { href: "/dashboard/digests", label: "تقارير الأهل", keys: "ولي الامر تقرير", icon: "📊" },
  { href: "/dashboard/referrals", label: "الإحالات والنمو", keys: "احالة نمو", icon: "🎁" },
  { href: "/dashboard/staff", label: "الفروع والطاقم", keys: "فرع طاقم موظف", icon: "🏢" },
  { href: "/dashboard/invoices", label: "الفواتير", keys: "فاتورة مصروفات", icon: "🧾" },
  { href: "/dashboard/messages", label: "الرسائل", keys: "رسائل منتدى", icon: "💬" },
  { href: "/dashboard/notifications", label: "الإشعارات", keys: "اشعارات تنبيه", icon: "🔔" },
  { href: "/dashboard/reports", label: "التقارير", keys: "تقارير تحليل", icon: "📈" },
  { href: "/dashboard/live", label: "اللايف", keys: "لايف بث مباشر", icon: "🔴" },
  { href: "/dashboard/schedule", label: "الجدول", keys: "جدول مواعيد", icon: "🗓️" },
  { href: "/dashboard/grades", label: "الدرجات", keys: "درجات", icon: "📝" },
  { href: "/dashboard/design", label: "تصميم الموقع", keys: "تصميم ثيم الوان موقع", icon: "🎨" },
  { href: "/dashboard/settings", label: "الإعدادات", keys: "اعدادات هوية", icon: "⚙️" },
  { href: "/admin", label: "لوحة المالك", keys: "ادمن مالك", icon: "👑" },
  { href: "/admin/billing", label: "فوترة المنصة", keys: "ايراد فواتير", icon: "💰" },
  { href: "/admin/dev", label: "لوحة المطور", keys: "مطور صحة", icon: "🛠️" },
];

/**
 * لوحة أوامر البحث الفوري (Ctrl+K) — تنقل الداشبورد بالكتابة بدل الحفظ.
 * فهرس ثابت (بلا خادم) + مطابقة عربية متسامحة.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ(""); setHi(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const norm = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
  const [recent, setRecent] = useState<Entry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("manara_recent_pages");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setRecent(arr.map((href) => INDEX.find((e) => e.href === href)).filter(Boolean) as Entry[]);
      }
    } catch {}
  }, [open]);

  function remember(href: string) {
    try {
      const raw = localStorage.getItem("manara_recent_pages");
      const arr = ((raw ? JSON.parse(raw) : []) as string[]).filter((h) => h !== href);
      localStorage.setItem("manara_recent_pages", JSON.stringify([href, ...arr].slice(0, 5)));
    } catch {}
  }

  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [...recent, ...INDEX.filter((e) => !recent.some((r) => r.href === e.href))].slice(0, 8);
    return INDEX.filter((e) => norm(e.label + " " + e.keys).includes(nq)).slice(0, 10);
  }, [q, recent]);

  useEffect(() => { setHi(0); }, [q]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="بحث"
        className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-200">
        🔍 <span className="hidden sm:inline">بحث سريع</span>
        <kbd className="rounded bg-white px-1.5 font-mono text-[10px]">Ctrl+K</kbd>
      </button>
    );
  }

  function go(href: string) {
    remember(href);
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          if (e.key === "Enter" && results[hi]) go(results[hi].href);
        }}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب: حضور، فواتير، امتحان..."
          className="w-full border-b border-slate-100 px-5 py-4 text-body outline-none" />
        <ul className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-4 py-6 text-center text-small text-slate-400">لا نتائج — جرّب كلمة أخرى</li>}
          {results.map((r, i) => (
            <li key={r.href}>
              <button onClick={() => go(r.href)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-right text-small font-bold ${i === hi ? "bg-primary-light text-primary" : "text-slate-700"}`}>
                <span className="text-lg">{r.icon}</span>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
