"use client";

import { useState } from "react";

/** تسجيل حضور ذاتي بمسح QR الجلسة — السر يتجدد كل 90 ثانية ضد لقطات الشاشة */
export default function SelfCheckin({ params }: { params: { id: string } }) {
  const [cardId, setCardId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const k = new URLSearchParams(window.location.search).get("k") ?? "";
      const r = await fetch(`/api/sessions/${params.id}/checkin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId.trim(), k }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setMsg({ ok: true, text: `تم تسجيل حضورك ✅ ${j.student ?? ""}` });
      else setMsg({ ok: false, text: j?.error === "expired" ? "انتهت صلاحية الرمز — امسح الرمز المعروض حالياً 🔄" : j?.error === "not_enrolled" ? "غير مسجل بهذه المجموعة." : "تعذر التسجيل — تأكد من رقم بطاقتك." });
    } catch { setMsg({ ok: false, text: "تعذر الاتصال." }); }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3 p-6 text-center">
        <div className="text-4xl">📋</div>
        <h1 className="text-h1">تسجيل الحضور</h1>
        <p className="text-xs text-slate-500">أدخل رقم بطاقتك (آخر 8 خانات من رابط البطاقة)</p>
        <input value={cardId} onChange={(e) => setCardId(e.target.value)} required dir="ltr"
          placeholder="مثال: a1b2c3d4" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center font-mono" />
        {msg && <div className={`rounded-xl p-3 text-small font-bold ${msg.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{msg.text}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "جاري..." : "سجّل حضورك ✅"}</button>
      </form>
    </main>
  );
}
