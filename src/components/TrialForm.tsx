"use client";

import { useEffect, useState } from "react";
import { WA_TRIAL_TEXT, waLink } from "@/lib/wa";
import { createClient } from "@/lib/supabase";

/**
 * نموذج تفعيل التجربة — مفيش نهاية عمياء أبداً:
 * 1) يبعت POST /api/trial
 * 2) لو السيرفر أنشأ الحساب → دخول تلقائي + شاشة نجاح بلينك اللوحة
 * 3) لو وضع المعاينة/الشبكة فشلت → يفتح واتساب + تأكيد مرئي على الصفحة
 */

type Phase = "idle" | "sending" | "done-live" | "done-fallback";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "manara.app";

export function TrialForm() {
  const [centerName, setCenterName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [slug, setSlug] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [formError, setFormError] = useState("");

  async function enterDashboard() {
    if (!creds) return;
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email: creds.email, password: creds.password });
    if (!error) {
      setSignedIn(true);
      window.location.href = "/dashboard";
    } else {
      setAuthErr("الدخول الآلي فشل — استخدم البيانات يدوياً في صفحة الدخول");
    }
  }

  // توجيه تلقائي مباشر لصفحته الجديدة بعد ثانية ونصف
  useEffect(() => {
    if (phase === "done-live" && slug) {
      const t = setTimeout(() => {
        window.location.href = `/${slug}`;
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("sending");
    setFormError("");

    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerName, phone, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.mode === "live" && data.slug) {
        setSlug(data.slug);
        setCreds(data.creds ?? { email, password });
        setPhase("done-live");
        return;
      }
      if (data?.error === "email_exists") {
        setFormError("البريد الإلكتروني مسجل مسبقاً — جرّب بريداً آخر");
        setPhase("idle");
        return;
      }
      if (data?.error === "invalid_credentials") {
        setFormError("تأكد من صحة البريد وكلمة السر (6 أحرف على الأقل)");
        setPhase("idle");
        return;
      }
      if (!res.ok && data?.error) {
        setFormError(data.details ?? data.error);
        setPhase("idle");
        return;
      }
    } catch {
      // الاستضافة الثابتة (GitHub Pages) — مفيش /api أصلاً
    }

    window.open(
      waLink(`${WA_TRIAL_TEXT}\nسنتر/اسمي: ${centerName}\nموبايلي: ${phone}\nبريد: ${email}`),
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
          تجربتك شغالة 7 أيام كاملة — منصتك:
        </p>
        <div className="mt-1 font-mono text-small font-bold" dir="ltr">{slug}.{ROOT_DOMAIN}</div>

        {creds && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-right">
            <div className="text-xs font-bold text-slate-500 mb-2">بيانات دخولك (احتفظ بيها):</div>
            <div className="text-small font-mono" dir="ltr">{creds.email}</div>
            <div className="text-small font-mono" dir="ltr">{creds.password}</div>
            {!signedIn && (
              <button onClick={enterDashboard} className="btn-primary w-full mt-3 !py-2.5 text-small">
                ادخل لوحة التحكم الآن
              </button>
            )}
            {signedIn && <a href="/dashboard" className="btn-primary w-full mt-3 !py-2.5 text-small inline-block">افتح لوحة التحكم</a>}
            {authErr && <p className="mt-2 text-xs text-danger">{authErr}</p>}
          </div>
        )}
      </div>
    );
  }

  if (phase === "done-fallback") {
    return (
      <div className="mt-6 rounded-xl border-2 border-success/30 bg-success/5 p-6 text-center">
        <div className="text-h1">✅</div>
        <h3 className="mt-2 text-h2 font-extrabold text-success">تم استلام طلبك بنجاح!</h3>
        <p className="mt-2 text-small leading-relaxed text-slate-600">
          سنتواصل معك خلال ساعات العمل لتفعيل منصتك الخاصة.
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
      <div>
        <label htmlFor="email" className="mb-1 block text-small font-bold">
          بريدك الإلكتروني
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          dir="ltr"
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-left outline-none transition focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-small font-bold">
          كلمة السر
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none transition focus:border-primary"
        />
        <p className="mt-1 text-xs text-slate-400">6 أحرف على الأقل</p>
      </div>
      {formError && (
        <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {formError}
        </div>
      )}
      <button type="submit" className="btn-primary w-full text-lg">
        ابدأ دلوقتي مجاناً 🚀
      </button>
      <p className="text-center text-xs text-slate-400">
        بدون بطاقة · تجربة 7 أيام كاملة
      </p>
    </form>
  );
}
