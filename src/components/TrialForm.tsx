"use client";

import { useState } from "react";
import { WA_TRIAL_TEXT, waLink } from "@/lib/wa";

/**
 * نموذج تفعيل التجربة — مفيش نهاية عمياء أبداً:
 * 1) يبعت POST /api/trial
 * 2) لو السيرفر أنشأ الحساب → شاشة نجاح بلينك منصة المعلم الحقيقية
 * 3) لو وضع المعاينة/الشبكة فشلت → يفتح واتساب + تأكيد مرئي على الصفحة
 */

type Phase = "idle" | "sending" | "done-live" | "done-fallback";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "manara.app";

export function TrialForm() {
  const [centerName, setCenterName] = useState("");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [slug, setSlug] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("sending");

    // الوضع الحقيقي: سيرفر ينشئ الحساب
    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerName, phone }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.mode === "live" && data.slug) {
          setSlug(data.slug);
          setPhase("done-live");
          return;
        }
      }
    } catch {
      // الاستضافة الثابتة (GitHub Pages) — مفيش /api أصلاً
    }

    // وضع المعاينة: واتساب + تأكيد مرئي (مش نهاية عمياء)
    window.open(
      waLink(`${WA_TRIAL_TEXT}\nسنتر/اسمي: ${centerName}\nموبايلي: ${phone}`),
      "_blank"
    );
    setPhase("done-fallback");
  }

  if (phase === "sending") {
    return (
      <div className="mt-6 rounded-xl bg-primary-light p-6 text-center">
        <div className="text-h2">⏳</div>
        <p className="mt-2 font-bold text-primary">جاري تجهيز سنترك...</p>
      </div>
    );
  }

  if (phase === "done-live" && slug) {
    return (
      <div className="mt-6 rounded-xl border-2 border-success/30 bg-success/5 p-6 text-center">
        <div className="text-h1">🎉</div>
        <h3 className="mt-2 text-h2 font-extrabold text-success">سنترك جاهز!</h3>
        <p className="mt-2 text-small text-slate-600">
          تجربتك شغالة 7 أيام كاملة — منصتك على الرابط ده:
        </p>
        <a
          href={`https://${slug}.${ROOT_DOMAIN}`}
          className="mt-4 inline-flex rounded-xl bg-success px-6 py-3 font-bold text-white transition hover:opacity-90"
        >
          ادخل منصتك: {slug}.{ROOT_DOMAIN}
        </a>
        <p className="mt-3 text-xs text-slate-400">
          كلمة الدخول اتبعتت على واتساب رقم {phone || "المسجل"} — غيّرها أول دخول
        </p>
      </div>
    );
  }

  if (phase === "done-fallback") {
    return (
      <div className="mt-6 rounded-xl border-2 border-success/30 bg-success/5 p-6 text-center">
        <div className="text-h1">✅</div>
        <h3 className="mt-2 text-h2 font-extrabold text-success">
          طلبك اتاستلم بنجاح!
        </h3>
        <p className="mt-2 text-small leading-relaxed text-slate-600">
          رسالة واتساب اتفتحتلك — اضغط إرسال وهنفعل حسابك ونرجعلك برابط
          منصتك الخاصة خلال ساعات العمل.
        </p>
        <button
          onClick={() => setPhase("idle")}
          className="btn-secondary mt-4 !px-5 !py-2 text-small"
        >
          تسجيل سنتر تاني
        </button>
      </div>
    );
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
      </div>
      <button type="submit" disabled={false} className="btn-primary w-full text-lg">
        ابدأ دلوقتي مجاناً 🚀
      </button>
      <p className="text-center text-xs text-slate-400">
        بدون بطاقة · تجربة 7 أيام كاملة
      </p>
    </form>
  );
}
