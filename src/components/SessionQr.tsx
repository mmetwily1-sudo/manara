"use client";

import { useEffect, useState } from "react";

/** QR الجلسة الدوّار — يعرض على شاشة القاعة، يتجدد كل 90 ثانية */
export default function SessionQr({ sessionId }: { sessionId: string | null }) {
  const [code, setCode] = useState<{ secret: string; expires_at: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [show, setShow] = useState(false);

  async function rotate() {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/sessions/${sessionId}/rotate`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setCode(j);
    } catch {}
  }

  useEffect(() => {
    setCode(null);
    if (!sessionId || !show) return;
    rotate();
    const t = setInterval(rotate, 75000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, show]);

  useEffect(() => {
    if (!code) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(code.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [code]);

  if (!sessionId) return null;
  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="btn-secondary text-small">
        عرض QR الجلسة 📱
      </button>
    );
  }
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = code ? `${appUrl}/a/${sessionId}?k=${code.secret}` : "";
  return (
    <div className="card flex items-center gap-4 p-4">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {link ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(link)}`} alt="QR" width={140} height={140} /> : <div className="text-small text-slate-400">جاري التوليد...</div>}
      </div>
      <div className="text-small">
        <div className="font-bold">امسح لتسجيل حضورك ✅</div>
        <div className="mt-1 text-xs text-slate-500">الرمز يتجدد تلقائياً — صالح لـ <b className={left <= 15 ? "text-danger" : ""}>{left} ثانية</b></div>
        <div className="mt-2 flex gap-2">
          <button onClick={rotate} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold">تجديد الآن 🔄</button>
          <button onClick={() => setShow(false)} className="text-xs text-slate-400">إخفاء</button>
        </div>
      </div>
    </div>
  );
}
