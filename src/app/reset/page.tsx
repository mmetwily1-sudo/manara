"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { supabaseAuthError } from "@/lib/auth-errors";
import { checkPassword } from "@/lib/password";

/** تعيين كلمة سر جديدة من رابط الاستعادة — يتحقق من الكود أولاً */
export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [bad, setBad] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const sb = createClient();
        const q = new URLSearchParams(window.location.search);
        const code = q.get("code");
        if (!code) { if (!stop) setBad("رابط الاستعادة ناقص — اطلب رابطاً جديداً من صفحة «نسيت كلمة السر»."); return; }
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (stop) return;
        if (error) setBad("الرابط منتهي أو مستخدم من قبل — اطلب رابطاً جديداً.");
        else setReady(true);
      } catch { if (!stop) setBad("تعذر الاتصال بالخادم — حاول تاني."); }
    })();
    return () => { stop = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwErr = checkPassword(pw1);
    if (pwErr) { setMsg(pwErr); return; }
    if (pw1 !== pw2) { setMsg("كلمتا السر غير متطابقتين — أعد الكتابة."); return; }
    setBusy(true); setMsg("");
    try {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password: pw1 });
      if (error) setMsg(supabaseAuthError(error.message));
      else { setDone(true); try { await sb.auth.signOut(); } catch {} }
    } catch { setMsg("تعذر الاتصال بالخادم — حاول تاني."); }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8">
        <Link href="/login" className="text-h2 font-extrabold text-primary">منارة</Link>
        <h1 className="mt-4 text-h1">كلمة سر جديدة 🔐</h1>
        {bad ? (
          <div className="mt-6 rounded-xl bg-danger/10 p-5 text-center">
            <p className="text-small font-bold text-danger">{bad}</p>
            <Link href="/forgot" className="btn-primary mt-4 inline-block w-full !py-2.5 text-small">اطلب رابطاً جديداً</Link>
          </div>
        ) : done ? (
          <div className="mt-6 rounded-xl border-2 border-success/30 bg-success/5 p-5 text-center">
            <div className="text-h1">✅</div>
            <p className="mt-2 text-small font-bold text-success">تم تغيير كلمة السر بنجاح</p>
            <Link href="/login" className="btn-primary mt-4 inline-block w-full !py-2.5 text-small">ادخل بكلمتك الجديدة</Link>
          </div>
        ) : !ready ? (
          <p className="mt-6 rounded-lg bg-primary-light px-3 py-2 text-center text-xs font-semibold text-primary">⏳ جاري التحقق من الرابط...</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="pw1" className="mb-1 block text-small font-bold">كلمة السر الجديدة</label>
              <div className="relative">
                <input id="pw1" type={showPw ? "text" : "password"} required value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 pl-12 outline-none focus:border-primary" />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label="إظهار/إخفاء"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">{showPw ? "🙈" : "👁️"}</button>
              </div>
              <p className="mt-1 text-xs text-slate-400">8 أحرف على الأقل — مع حرف ورقم</p>
            </div>
            <div>
              <label htmlFor="pw2" className="mb-1 block text-small font-bold">تأكيد كلمة السر</label>
              <input id="pw2" type={showPw ? "text" : "password"} required value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-primary" />
            </div>
            {msg && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{msg}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "جاري الحفظ..." : "حفظ كلمة السر"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
