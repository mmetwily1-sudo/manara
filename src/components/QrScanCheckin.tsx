"use client";

import { useEffect, useRef, useState } from "react";

/** مسح بطاقات الطلاب من لوحة المعلم: كاميرا → تحضير فوري (BarcodeDetector، بديل رسالة) */
export default function QrScanCheckin({ sessionId }: { sessionId: string | null }) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [msg, setMsg] = useState("");
  const [last, setLast] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  async function checkin(cardId: string) {
    setMsg("جاري التحضير...");
    try {
      const g = await fetch(`/api/sessions/${sessionId}/rotate`, { cache: "no-store" });
      const gj = await g.json().catch(() => null);
      if (!g.ok || !gj?.ok) { setMsg("ولّد رمز الجلسة أولاً من زر QR الجلسة."); return; }
      const r = await fetch(`/api/sessions/${sessionId}/checkin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId, k: gj.secret }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setLast(j.student);
        setMsg(`تم تحضير ${j.student} ✅`);
      } else {
        setMsg(j?.error === "not_enrolled" ? "الطالب غير مسجل بهذه المجموعة." : j?.error === "expired" ? "انتهى الرمز — جدده." : "تعذر التحضير.");
      }
    } catch { setMsg("تعذر الاتصال."); }
  }

  async function start() {
    if (!sessionId) { setMsg("اختر مجموعة أولاً (لا جلسة نشطة)."); return; }
    setOpen(true);
    setMsg("");
    stopRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const BD = (window as any).BarcodeDetector;
      const detector = new BD({ formats: ["qr_code"] });
      let lastCode = "";
      let sameCount = 0;
      const tick = async () => {
        if (stopRef.current) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes?.[0]?.rawValue ? String(codes[0].rawValue) : "";
          if (raw) {
            if (raw === lastCode) sameCount++;
            else { lastCode = raw; sameCount = 1; }
            // تأكيد قراءتين متتاليتين لمنع التكرار
            if (sameCount === 2) {
              sameCount = 0;
              const m = raw.match(/manara:student:([0-9a-f-]{8,})/i);
              await checkin(m ? m[1] : raw);
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
        } catch {}
        setTimeout(tick, 400);
      };
      tick();
    } catch {
      setMsg("تعذر فتح الكاميرا — اسمح بالوصول من المتصفح.");
    }
  }

  function stop() {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  }

  useEffect(() => () => { stopRef.current = true; streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  if (!sessionId) return null;
  if (!open) {
    return (
      <button onClick={start} className="btn-secondary text-small" title={!supported ? "المسح يحتاج كروم/أندرويد حديث" : ""}>
        مسح بطاقات الطلاب 📷
      </button>
    );
  }
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">مسح البطاقات 📷</h2>
        <button onClick={stop} className="text-xs font-bold text-slate-400">إغلاق ✕</button>
      </div>
      {!supported && <div className="text-xs font-bold text-warning">متصفحك لا يدعم المسح — استخدم كروم على أندرويد.</div>}
      <video ref={videoRef} playsInline muted className="aspect-square w-full rounded-xl bg-black object-cover" />
      {last && <div className="text-center text-small font-bold text-success">آخر تحضير: {last} ✅</div>}
      {msg && <div className="text-center text-small font-bold text-primary">{msg}</div>}
    </div>
  );
}
