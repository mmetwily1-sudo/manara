"use client";

import { useState } from "react";

export function StudentRegisterForm({ slug, teacherPhone }: { slug: string; teacherPhone?: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("sending");
    setMsg("");
    try {
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, phone, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "email_exists") setMsg("البريد مسجل مسبقاً — جرّب بريداً آخر");
        else if (data.error === "weak_password") setMsg("كلمة السر ضعيفة — 6 أحرف على الأقل");
        else setMsg(data.details ?? data.error ?? "حدث خطأ");
        setPhase("error");
        return;
      }
      setPhase("done");
    } catch {
      setMsg("خطأ في الاتصال");
      setPhase("error");
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
    const text = `مرحباً ${name}، بيانات دخولك لمنصة ${slug}:\nالبريد: ${email}\nكلمة السر: ${password}\nرابط الدخول: ${window.location.origin}/login`;
    window.open(`https://wa.me/${phone.replace(/\D/g, "") || "201025183569"}?text=${encodeURIComponent(text)}`, "_blank");
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
      <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة السر (6+ أحرف)" className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
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
