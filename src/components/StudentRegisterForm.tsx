"use client";

import { useState } from "react";
import { Turnstile } from "@/components/Turnstile";

export function StudentRegisterForm({ slug, teacherPhone }: { slug: string; teacherPhone?: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "otp" | "verifying" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [waSent, setWaSent] = useState(true);
  const [otp, setOtp] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("sending");
    setMsg("");
    try {
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, phone, email, password, captchaToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "email_exists" || data.error === "phone_exists") setMsg(data.message ?? "مسجل مسبقاً — ادخل مباشرة بدون باسورد من الأسفل 👇");
        else if (data.error === "weak_password") setMsg(data.message ?? "كلمة السر ضعيفة — 8 أحرف على الأقل مع حرف ورقم");
        else setMsg(data.message ?? data.details ?? data.error ?? "حدث خطأ");
        setPhase("error");
        return;
      }
      // الرقم مربوط بصف موجود → تحقق واتساب قبل الربط
      if (data.otp_required) {
        setMaskedPhone(data.masked_phone ?? "");
        setWaSent(data.whatsapp_sent !== false);
        setPhase("otp");
        return;
      }
      setPhase("done");
    } catch {
      setMsg("خطأ في الاتصال");
      setPhase("error");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setPhase("verifying");
    setMsg("");
    try {
      const res = await fetch("/api/students/verify-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, phone, code: otp, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg(data.message ?? "فشل التحقق — حاول مجدداً");
        setPhase("otp");
        return;
      }
      setPhase("done");
    } catch {
      setMsg("خطأ في الاتصال");
      setPhase("otp");
    }
  }

  const [sentVia, setSentVia] = useState<"" | "email" | "whatsapp">("");

  async function sendViaEmail() {
    setSentVia("email");
    // Supabase سيرسل رابط دخول على البريد تلقائياً (Magic Link)
    try {
      const { createClient } = await import("@/lib/supabase");
      const sb = createClient();
      await sb.auth.signInWithOtp({ email });
    } catch {}
  }

  function sendViaWhatsapp() {
    setSentVia("whatsapp");
    // لا نضع كلمة السر في الرابط أبداً (تظهر في سجل المتصفح) — رابط الدخول فقط
    const text = `مرحباً ${name}، تم تسجيلك في منصة ${slug} ✅\nسجّل دخولك بالبريد ${email} من هنا: ${window.location.origin}/login`;
    window.open(`https://wa.me/${phone.replace(/\D/g, "") || "201025183569"}?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (phase === "otp" || phase === "verifying") {
    return (
      <form onSubmit={handleVerify} className="mx-auto mt-8 max-w-md space-y-3 rounded-xl border bg-white p-6 text-right">
        <h3 className="text-center font-bold">تحقق من رقمك 📲</h3>
        <p className="text-center text-small text-slate-600">
          رقمك مسجل لدينا ({maskedPhone || phone}) — أرسلنا رمز تحقق من 6 أرقام على واتساب.
          {!waSent && " (تعذّر الإرسال التلقائي — اطلب الرمز من إدارة السنتر.)"}
        </p>
        {phase === "otp" && msg && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{msg}</div>}
        <input required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="─ ─ ─ ─ ─ ─" dir="ltr" inputMode="numeric" maxLength={6}
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-primary" />
        <button disabled={phase === "verifying" || otp.length !== 6} className="btn-primary w-full">
          {phase === "verifying" ? "جاري التحقق..." : "تأكيد وربط حسابي"}
        </button>
        <button type="button" onClick={handleSubmit} className="w-full text-center text-xs font-bold text-primary">
          إعادة إرسال الرمز
        </button>
      </form>
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl border-2 border-success/30 bg-success/5 p-6 text-center">
        <div className="text-2xl">🎉</div>
        <h3 className="mt-2 font-bold text-success">تم تسجيلك بنجاح!</h3>
        <p className="mt-2 text-small text-slate-600">
          اختر كيف تريد استلام بيانات الدخول:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button onClick={sendViaEmail} className="rounded-xl border-2 border-primary bg-white px-4 py-3 text-small font-bold text-primary transition hover:bg-primary-light">
            📧 عبر البريد الإلكتروني
            <span className="block text-xs font-normal text-slate-500">{email}</span>
          </button>
          <button onClick={sendViaWhatsapp} className="rounded-xl border-2 border-[#25D366] bg-white px-4 py-3 text-small font-bold text-[#25D366] transition hover:bg-green-50">
            💬 عبر واتساب
            <span className="block text-xs font-normal text-slate-500">{phone || "رقمك"}</span>
          </button>
        </div>
        {sentVia === "email" && <p className="mt-3 text-xs font-semibold text-success">✓ تم الإرسال على بريدك — تفقد صندوق الوارد</p>}
        {sentVia === "whatsapp" && <p className="mt-3 text-xs font-semibold text-success">✓ تم فتح واتساب — أرسل الرسالة</p>}
        <a href="/login" className="btn-primary mt-5 inline-block w-full">
          تسجيل الدخول الآن
        </a>
        <p className="mt-2 text-xs text-slate-400">بياناتك: <span className="font-mono" dir="ltr">{email}</span></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-md space-y-3 rounded-xl border bg-white p-6 text-right">
      <h3 className="text-center font-bold">سجّل كطالب جديد</h3>
      {phase === "error" && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{msg}</div>}
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الموبايل (اختياري)" dir="ltr" className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-left outline-none focus:border-primary" />
      <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر (8+ أحرف مع حرف ورقم)" className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
      <Turnstile onToken={setCaptchaToken} />
      <button disabled={phase === "sending"} className="btn-primary w-full">
        {phase === "sending" ? "جاري التسجيل..." : "سجّل الآن"}
      </button>
      {teacherPhone && (
        <p className="text-center text-xs text-slate-400">
          أو تواصل مباشرة مع المعلم على{" "}
          <a href={`https://wa.me/${teacherPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">
            واتساب
          </a>
        </p>
      )}
    </form>
  );
}
