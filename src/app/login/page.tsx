"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
import { PhoneLoginForm } from "@/components/PhoneLoginForm";

/** بوابة دخول الطلاب برقم الموبايل: رابط السنتر + النموذج */
function PhoneSlugGate() {
  const [slug, setSlug] = useState("");
  const [go, setGo] = useState(false);
  return (
    <div className="mt-3">
      {!go ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (slug.trim()) setGo(true); }}
          className="flex gap-2"
        >
          <input
            value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="رابط سنترك (مثال: elnour)" dir="ltr"
            className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-center outline-none focus:border-primary"
          />
          <button className="btn-secondary whitespace-nowrap !py-2 text-small">متابعة</button>
        </form>
      ) : (
        <PhoneLoginForm slug={slug.trim().toLowerCase()} />
      )}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupPhone, setSetupPhone] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErr(
        error.message.includes("Invalid login")
          ? "البريد أو كلمة السر غير صحيحة"
          : "حدث خطأ — حاول تاني أو كلمنا على واتساب"
      );
      return;
    }
    // مزامنة الحساب مع سنتره (شفاء ذاتي لو الصف مفقود) ثم الدخول
    try {
      const r = await fetch("/api/auth/sync");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setBusy(false);
        if (j?.error === "no_tenant") {
          // حساب يتيم: أكمل الإعداد هنا مباشرة بدل التنقل لصفحة أخرى
          setNeedsSetup(true);
          return;
        }
        setErr("تعذر تجهيز حسابك — حاول تاني");
        return;
      }
    } catch {
      setBusy(false);
      setErr("تعذر الاتصال بالخادم — حاول تاني");
      return;
    }
    try {
      localStorage.setItem("manara_last_email", email.trim().toLowerCase());
    } catch {}
    window.location.href = "/dashboard";
  }

  async function handleGoogle() {
    setBusy(true); setErr("");
    try {
      const sb = createClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) setErr("دخول جوجل غير مفعل بعد — فعّله المالك من إعدادات Supabase.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerName: setupName, phone: setupPhone }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setErr(j?.error === "phone_exists" ? "هذا الرقم مسجل لطالب آخر — استخدم رقماً مختلفاً" : "تعذر إنشاء السنتر — حاول تاني");
    } catch {
      setErr("تعذر الاتصال بالخادم — حاول تاني");
    }
    setBusy(false);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="card w-full max-w-sm p-8 shadow-[0_8px_30px_-6px_rgba(26,115,232,0.25)]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-primary to-primary-dark text-xl font-extrabold text-white shadow-[0_8px_30px_-6px_rgba(26,115,232,0.35)]">ن</span>
          <Link href="/" className="text-h2 font-extrabold text-primary">منارة</Link>
        </div>
        <h1 className="mt-4 text-h1">أهلاً بعودتك 👋</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-small font-bold">البريد التعليمي</label>
            <input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@manara.app" dir="ltr"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-right outline-none focus:border-primary" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-small font-bold">كلمة السر</label>
            <input id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-primary" />
          </div>
          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "جاري الدخول..." : "دخول"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          أو
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <PasskeyLoginButton email={email} />
        <button onClick={handleGoogle} disabled={busy} className="btn-secondary mt-3 w-full disabled:opacity-50">
          <span aria-hidden className="text-lg font-extrabold">G</span> دخول بجوجل بلمسة واحدة
        </button>

        <details className="mt-4">
          <summary className="cursor-pointer text-center text-small font-bold text-primary">دخول برقم الموبايل 📱</summary>
          <PhoneSlugGate />
        </details>

        {needsSetup && (
          <form onSubmit={handleSetup} className="mt-6 space-y-4 rounded-xl border-2 border-primary/20 bg-primary-light/40 p-5">
            <h2 className="text-small font-bold">حسابك جاهز — أنشئ سنترك الآن 🎉</h2>
            <div>
              <label htmlFor="setupName" className="mb-1 block text-small font-bold">اسم سنترك أو اسمك كمدرس</label>
              <input id="setupName" required value={setupName} onChange={(e) => setSetupName(e.target.value)}
                placeholder="مثال: سنتر النور"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none focus:border-primary" />
            </div>
            <div>
              <label htmlFor="setupPhone" className="mb-1 block text-small font-bold">رقم الموبايل</label>
              <input id="setupPhone" type="tel" inputMode="tel" required value={setupPhone} onChange={(e) => setSetupPhone(e.target.value)}
                placeholder="01xxxxxxxxx" dir="ltr"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-right outline-none focus:border-primary" />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "جاري الإنشاء..." : "إنشاء سنتري والدخول"}
            </button>
          </form>
        )}

        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-center text-xs leading-relaxed text-slate-500">
          بيانات دخولك وصلتك على شاشة نجاح التسجيل —
          ولأي مشكلة زرار الواتساب تحت
        </p>
        <p className="mt-3 text-center text-small text-slate-500">
          أول مرة؟ <Link href="/join" className="font-bold text-primary">اعمل حسابك المجاني</Link>
        </p>
        <Link href="/join" className="mt-3 block rounded-xl border-2 border-dashed border-primary/40 p-3 text-center text-small font-bold text-primary transition hover:bg-primary-light">
          👁️ مستعجل؟ جولة فورية بدون تسجيل
        </Link>
      </div>
    </main>
  );
}
