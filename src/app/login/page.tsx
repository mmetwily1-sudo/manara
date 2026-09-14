"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

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
    window.location.href = "/dashboard";
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
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8">
        <Link href="/" className="text-h2 font-extrabold text-primary">منارة</Link>
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
      </div>
    </main>
  );
}
