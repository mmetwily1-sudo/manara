"use client";

import { useState } from "react";

/** دخول الطالب برقم الموبايل + PIN (يعمل بلا واتساب/بريد — للأونلاين والتقدم) */
export function StudentPinLogin({ slug }: { slug: string }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/students/pin-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone, pin }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        window.location.href = j.redirect ?? "/progress";
        return;
      }
      setMsg(j?.message ?? "تعذر الدخول — تأكد من الرقم والـ PIN");
    } catch { setMsg("تعذر الاتصال بالخادم"); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-4 max-w-md rounded-xl border-2 border-primary/30 bg-white p-5">
      <h3 className="text-center font-bold">🔑 دخول الطلاب برقم الموبايل + PIN</h3>
      <p className="mt-1 text-center text-xs text-slate-500">الـ PIN من إدارة السنتر (6 أرقام) — للدخول للامتحانات الأونلاين ومتابعة تقدمك</p>
      {msg && <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-center text-xs font-bold text-danger">{msg}</p>}
      <div className="mt-3 flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr"
          placeholder="01xxxxxxxxx" inputMode="tel"
          className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} required dir="ltr"
          placeholder="PIN" inputMode="numeric" maxLength={6}
          className="w-28 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-center font-mono font-bold outline-none focus:border-primary" />
      </div>
      <button disabled={busy || pin.length !== 6} className="btn-primary mt-3 w-full disabled:opacity-50">
        {busy ? "جاري الدخول..." : "دخول"}
      </button>
    </form>
  );
}
