"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Step = { t: string; d: string; href: string; cta: string };

const FLOWS: Record<string, Step[]> = {
  teacher: [
    { t: "1️⃣ أنشئ مجموعتك", d: "مجموعة لكل صف + مواعيدها — دقيقتان فقط.", href: "/dashboard/groups", cta: "إنشاء مجموعة" },
    { t: "2️⃣ أضف طلابك", d: "بالاسم أو انسخ رابط التسجيل لهم.", href: "/dashboard/students", cta: "إضافة طلاب" },
    { t: "3️⃣ أصدر فواتير الشهر", d: "بضغطة واحدة لكل المسجلين.", href: "/dashboard/invoices", cta: "إصدار الفواتير" },
  ],
  student: [
    { t: "1️⃣ سلّم واجباتك", d: "صوّر الحل أو اكتبه نصاً — التصحيح الذاتي فوري.", href: "/progress", cta: "عرض واجباتي" },
    { t: "2️⃣ تابع نقاطك", d: "اجمع نقاطاً واستبدلها بمكافآت.", href: "/progress", cta: "متجر النقاط" },
    { t: "3️⃣ شارك في المنتدى", d: "اسأل وناقش مع معلميك.", href: "/progress", cta: "فتح المنتدى" },
  ],
  parent: [
    { t: "1️⃣ تابع الحضور لحظة بلحظة", d: "غياب ابنك يوصلك فوراً.", href: "/parent", cta: "عرض الحضور" },
    { t: "2️⃣ راجع الدرجات", d: "كل امتحان بدرجته وتاريخه.", href: "/parent", cta: "عرض الدرجات" },
    { t: "3️⃣ ادفع أونلاين", d: "بطاقة أو محفظة — بإيصال فوري.", href: "/parent", cta: "عرض المستحقات" },
  ],
};

/** تعريف سريع من 3 خطوات حسب الدور — يظهر مرة واحدة */
export function Onboarding({ role }: { role: "teacher" | "student" | "parent" }) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(`onb_${role}`)) setShow(true);
    } catch { setShow(true); }
  }, [role]);
  if (!show) return null;
  const steps = FLOWS[role] ?? FLOWS.teacher;
  const s = steps[Math.min(step, steps.length - 1)];
  const done = () => {
    try { localStorage.setItem(`onb_${role}`, "1"); } catch {}
    setShow(false);
  };
  return (
    <div className="card space-y-3 border-2 border-primary/20 bg-gradient-to-l from-primary-light/60 to-transparent p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">🚀 ابدأ في 3 خطوات</h2>
        <button onClick={done} className="text-xs font-bold text-slate-400">تخطي ✕</button>
      </div>
      <div className="flex gap-1.5" dir="ltr">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-slate-200"}`} />
        ))}
      </div>
      <div>
        <div className="font-bold">{s.t}</div>
        <p className="mt-1 text-small text-slate-500">{s.d}</p>
      </div>
      <div className="flex gap-2">
        <Link href={s.href} onClick={done} className="btn-primary flex-1 !py-2.5 text-small">{s.cta}</Link>
        {step < steps.length - 1 && (
          <button onClick={() => setStep(step + 1)} className="btn-secondary !py-2.5 text-small">التالي ←</button>
        )}
      </div>
    </div>
  );
}
