"use client";

import { useEffect, useState } from "react";

type Info = { renewal_state?: string };

/**
 * بانر حالة الاشتراك المدفوع: يظهر فقط في grace/suspended (بانر due_soon يغطيه TrialBanner
 * القائم لتفادي الازدواج). الموقوف يرى بياناته كاملة للقراءة — البانر يشرح وضع القراءة فقط.
 */
export default function RenewalBanner() {
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/info").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return;
      if (j.renewal_state === "grace" || j.renewal_state === "suspended") setState(j.renewal_state);
    }).catch(() => {});
  }, []);

  if (!state) return null;
  const suspended = state === "suspended";

  return (
    <section className={`card space-y-2 p-5 ${suspended ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {suspended ? "⏸️ الاشتراك موقوف مؤقتاً — بياناتك محفوظة وتُعرض للقراءة"
              : "⚠️ اشتراكك انتهى ودخلت فترة السماح"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {suspended
              ? "الإضافة والتعديل متوقفان حتى التجديد — طلابك وأولياء أمورهم غير متأثرين."
              : "جدد الآن قبل الإيقاف المؤقت — لن تفقد أي بيانات في أي حال."}
          </p>
        </div>
        <a href="/pricing?plan=pro" className="btn-primary shrink-0 text-small">
          {suspended ? "أعد التفعيل ←" : "جدد الآن ←"}
        </a>
      </div>
    </section>
  );
}
