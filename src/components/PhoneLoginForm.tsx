"use client";

import { useState } from "react";

/** دخول برقم الهاتف بدون باسورد — رمز واتساب ثم جلسة (tenant slug). */
export function PhoneLoginForm({ slug }: { slug?: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"idle" | "code" | "done">("idle");
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const [masked, setMasked] = useState("");

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!slug) { setMsg("رابط السنتر غير معروف."); return; }
    setWorking(true); setMsg("");
    try {
      const r = await fetch("/api/students/phone-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMasked(j.masked_phone ?? "");
        setMsg(j.sent ? `أرسلنا رمزاً إلى ${j.masked_phone}` : "الواتساب غير مربوط حالياً — اطلب الرمز من إدارة السنتر.");
        setPhase("code");
      } else { setMsg(j?.message ?? "فشل الإرسال: " + (j?.error ?? "")); setPhase("idle"); }
    } catch { setMsg("تعذر الاتصال بالخادم."); setPhase("idle"); }
    finally { setWorking(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setMsg("");
    try {
      const r = await fetch("/api/students/phone-verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone, code }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setPhase("done");
        window.location.href = j.redirect ?? "/progress";
      } else { setMsg(j?.message ?? "فشل التحقق: " + (j?.error ?? "")); setPhase("code"); }
    } catch { setMsg("تعذر الاتصال بالخادم."); setPhase("code"); }
    finally { setWorking(false); }
  }

  if (phase === "done") return <p className="text-center text-small font-bold text-success">تم الدخول — جاري تحويلك…</p>;

  return (
    <div className="mx-auto mt-4 max-w-md rounded-xl border-2 border-dashed border-primary/40 bg-white p-5">
      <h3 className="text-center font-bold">📱 دخول برقم الهاتف <span className="text-xs font-normal text-slate-500">(بدون باسورد)</span></h3>
      {msg && <p className="mt-2 text-center text-small font-bold text-primary">{msg}</p>}
      {phase === "code" ? (
        <form onSubmit={verify} className="mt-3 space-y-3">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="─ ─ ─ ─ ─ ─" dir="ltr" inputMode="numeric" maxLength={6} required
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-primary" />
          <button disabled={working || code.length !== 6} className="btn-primary w-full">
            {working ? "جاري التحقق..." : "دخول"}
          </button>
          <button type="button" onClick={() => sendCode()} className="w-full text-center text-xs font-bold text-primary">إعادة إرسال الرمز{masked ? ` (${masked})` : ""}</button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="mt-3 flex gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr"
            placeholder="01xxxxxxxxx" inputMode="tel"
            className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
          <button disabled={working} className="btn-secondary whitespace-nowrap">
            {working ? "جاري..." : "أرسل الرمز"}
          </button>
        </form>
      )}
    </div>
  );
}
