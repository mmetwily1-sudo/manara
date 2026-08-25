"use client";

import { useState } from "react";
import { WA_TRIAL_TEXT, waLink } from "@/lib/wa";

/**
 * نموذج تفعيل التجربة — يفتح واتساب برسالة معبأة
 * (شغال على أي استضافة ثابتة، ولما نربط Supabase هنستبدل onSubmit باستدعاء API واحد)
 */
export function TrialForm() {
  const [centerName, setCenterName] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = `${WA_TRIAL_TEXT}\nسنتر/اسمي: ${centerName}\nموبايلي: ${phone}`;
    window.open(waLink(msg), "_blank");
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="centerName" className="mb-1 block text-small font-bold">
          اسم سنترك أو اسمك كمدرس
        </label>
        <input
          id="centerName"
          required
          value={centerName}
          onChange={(e) => setCenterName(e.target.value)}
          placeholder="مثال: سنتر النور"
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none transition focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-small font-bold">
          رقم موبايلك
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01xxxxxxxxx"
          dir="ltr"
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-right outline-none transition focus:border-primary"
        />
        <p className="mt-1 text-xs text-slate-400">
          هنبعتلك رسالة واتساب جاهزة — اضغط إرسال وهنرد عليك في دقائق
        </p>
      </div>
      <button type="submit" className="btn-primary w-full text-lg">
        ابدأ دلوقتي مجاناً 🚀
      </button>
    </form>
  );
}
