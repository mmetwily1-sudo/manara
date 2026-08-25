"use client";

import Link from "next/link";
import { useState } from "react";
import { waLink } from "@/lib/wa";

export default function LoginPage() {
  const [phone, setPhone] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = `أهلاً، عايز أدخل حسابي في منارة\nموبايلي: ${phone}`;
    window.open(waLink(msg), "_blank");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8">
        <Link href="/" className="text-h2 font-extrabold text-primary">منارة</Link>
        <h1 className="mt-4 text-h1">أهلاً بعودتك 👋</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="phone" className="mb-1 block text-small font-bold">رقم الموبايل</label>
            <input id="phone" type="tel" inputMode="tel" required value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx" dir="ltr"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-right outline-none focus:border-primary" />
          </div>
          <button type="submit" className="btn-primary w-full">دخول</button>
        </form>

        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-center text-xs leading-relaxed text-slate-500">
          الدخول المباشر بيتفعّل بعد ربط قاعدة البيانات — حالياً تواصلك بيوصلنا فوراً على واتساب
        </p>
        <p className="mt-3 text-center text-small text-slate-500">
          أول مرة؟ <Link href="/join" className="font-bold text-primary">اعمل حسابك المجاني</Link>
        </p>
      </div>
    </main>
  );
}
