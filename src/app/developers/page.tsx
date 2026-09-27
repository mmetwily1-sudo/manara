import Link from "next/link";

const GROUPS: { title: string; routes: { m: string; p: string; d: string }[] }[] = [
  {
    title: "التحصيل والفواتير 💰",
    routes: [
      { m: "GET", p: "/api/payments", d: "الدفعات + ملخص الشهر (مالك/محاسب/مشرف)" },
      { m: "POST", p: "/api/payments", d: "تسجيل دفعة — مبالغ كبيرة تُعلق للمراجعة" },
      { m: "GET", p: "/api/invoices", d: "الفواتير + المتأخرات الذكية بالدرجات" },
      { m: "POST", p: "/api/invoices", d: "إصدار فواتير شهر {action:'issue'}" },
      { m: "GET", p: "/api/export?scope=students|payments|invoices|grades", d: "تصدير CSV" },
    ],
  },
  {
    title: "الحضور والطلاب 📋",
    routes: [
      { m: "POST", p: "/api/attendance", d: "تسجيل حضور {sessionId, studentId, status}" },
      { m: "GET/POST", p: "/api/students", d: "الطلاب + إضافة" },
      { m: "POST", p: "/api/students/import", d: "استيراد بالجملة {rows:[{name,phone,group_id}]}" },
      { m: "GET", p: "/api/leaderboard?group_id=", d: "متصدرون (أسماء مخفاة)" },
    ],
  },
  {
    title: "الامتحانات 🎓",
    routes: [
      { m: "GET", p: "/api/exams", d: "القائمة مع العدّات" },
      { m: "POST", p: "/api/exams/[id]/duplicate", d: "نسخ بأسئلته {title?}" },
      { m: "GET", p: "/api/questions/quality", d: "تقييم جودة البنك" },
      { m: "POST", p: "/api/grades/import", d: "درجات ورقية {exam_id, rows}" },
      { m: "GET/POST", p: "/api/exam-templates", d: "مكتبة القوالب (حفظ/استخدام)" },
    ],
  },
  {
    title: "الإشعارات والقوالب 🔔",
    routes: [
      { m: "GET", p: "/api/notifications", d: "المركز الموحد + SMS" },
      { m: "GET/PATCH", p: "/api/tenant/notify-rules", d: "قواعد الأحداث" },
      { m: "GET/POST", p: "/api/templates", d: "قوالب الرسائل" },
      { m: "POST", p: "/api/digests", d: "تقارير أهل {mode: weekly|monthly}" },
    ],
  },
  {
    title: "النمو والتحليلات 📈",
    routes: [
      { m: "GET", p: "/api/analytics/funnel", d: "قمع التحويل" },
      { m: "GET", p: "/api/analytics/forecast", d: "تنبؤ تحصيل/تسرب" },
      { m: "GET", p: "/api/analytics/compare", d: "مقارنة شهور + cohorts" },
      { m: "GET", p: "/api/reports/profitability", d: "ربحية فرع/مدرس/مجموعة" },
      { m: "GET/POST", p: "/api/webhooks", d: "ويبهوكات صادرة بتوقيع HMAC" },
    ],
  },
];

/** توثيق API للمطورين — الكتالوج الحي */
export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-h1">واجهات منارة للمطورين 🧩</h1>
        <p className="mt-1 text-small text-slate-500">
          كل المسارات تتطلب جلسة دخول (كوكيز Supabase) + دوراً مناسباً — الردود JSON بصيغة {"{ok:true, ...}"}.
          الأحداث الخارجية عبر <Link href="/dashboard/webhooks" className="font-bold text-primary underline">الويبهوكات</Link> بتوقيع <code dir="ltr">X-Manara-Signature</code>.
        </p>
      </header>
      {GROUPS.map((g) => (
        <section key={g.title} className="card space-y-2 p-5">
          <h2 className="font-bold">{g.title}</h2>
          {g.routes.map((r) => (
            <div key={r.m + r.p} className="flex flex-wrap items-baseline gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${r.m.includes("GET") ? "bg-success/10 text-success" : "bg-primary-light text-primary"}`} dir="ltr">{r.m}</span>
              <code className="font-mono text-xs font-bold" dir="ltr">{r.p}</code>
              <span className="text-slate-500">{r.d}</span>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
