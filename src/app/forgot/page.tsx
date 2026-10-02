"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { supabaseAuthError } from "@/lib/auth-errors";

/** نسيت كلمة السر: رابط استعادة على البريد — عربي بالكامل */
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [cool, setCool] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cool > 0) return;
    setBusy(true); setMsg("");
    try {
      const sb = createClient();
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) { setMsg(supabaseAuthError(error.message)); }
      else { setDone(true); }
    } catch { setMsg("تعذر الاتصال بالخادم — تأكد من الإنترنت وحاول تاني"); }
    setBusy(false);
    // تهدئة 60 ثانية ضد الإغراق
    setCool(60);
    const t = setInterval(() => setCool((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8">
        <Link href="/login" className="text-h2 font-extrabold text-primary">منارة</Link>
        <h1 className="mt-4 text-h1">نسيت كلمة السر؟ 🔑</h1>
        {done ? (
          <div className="mt-6 rounded-xl border-2 border-success/30 bg-success/5 p-5 text-center">
            <div className="text-h1">📩</div>
            <p className="mt-2 text-small font-bold text-success">أرسلنا رابط الاستعادة لبريدك</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              افتح بريدك واضغط الرابط خلال ساعة — وتفقد السبام لو لم تجده.
            </p>
            <Link href="/login" className="btn-secondary mt-4 inline-block w-full !py-2.5 text-small">رجوع للدخول</Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-small text-slate-600">اكتب بريد حسابك وهنبعتلك رابط تعيين كلمة جديدة.</p>
            <div>
              <label htmlFor="email" className="mb-1 block text-small font-bold">البريد الإلكتروني</label>
              <input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com" dir="ltr"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-left outline-none focus:border-primary" />
            </div>
            {msg && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{msg}</p>}
            <button type="submit" disabled={busy || cool > 0} className="btn-primary w-full disabled:opacity-50">
              {busy ? "جاري الإرسال..." : cool > 0 ? `انتظر ${cool} ثانية قبل إعادة الإرسال` : "ابعت رابط الاستعادة"}
            </button>
            <p className="text-center text-small text-slate-500">
              افتكرتها؟ <Link href="/login" className="font-bold text-primary">ادخل من هنا</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
