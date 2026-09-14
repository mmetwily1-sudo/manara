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

  if (phase === "done") {
    return (
      <div className="rounded-xl border-2 border-success/30 bg-success/5 p-6 text-center">
        <div className="text-2xl">🎉</div>
        <h3 className="mt-2 font-bold text-success">تم تسجيلك بنجاح!</h3>
        <p className="mt-2 text-small text-slate-600">
          بيانات دخولك: <span className="font-mono" dir="ltr">{email}</span>
          <br />
          يمكنك الآن تسجيل الدخول من صفحة الدخول.
        </p>
        <a href="/login" className="btn-primary mt-4 inline-block">
          تسجيل الدخول
        </a>
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
