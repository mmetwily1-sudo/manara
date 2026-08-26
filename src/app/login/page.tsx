"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setErr(
        error.message.includes("Invalid login")
          ? "البريد أو كلمة السر غير صحيحة"
          : "حدث خطأ — حاول تاني أو كلمنا على واتساب"
      );
      return;
    }
    window.location.href = "/dashboard";
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
