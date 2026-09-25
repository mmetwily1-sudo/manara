"use client";

import { useEffect, useState } from "react";

/** حملة NPS: تظهر مرة بعد 14 يوم نشاط (قرار اللجنة) — ≤6 متابعة نصية، 9-10 دعوة إحالة */
export default function NpsBanner() {
  const [show, setShow] = useState(false);
  const [score, setScore] = useState(0);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("manara.nps.dismissed.v1")) return;
    } catch {}
    fetch("/api/nps-status").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.show) setShow(true);
    }).catch(() => {});
  }, []);

  function dismiss() {
    try { localStorage.setItem("manara.nps.dismissed.v1", "1"); } catch {}
    setShow(false);
  }

  async function send() {
    if (!score) return;
    setBusy(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "nps", score, text }),
      });
      if (r.ok) { setDone(true); setShow(false); }
    } catch {}
    finally { setBusy(false); }
  }

  if (done || !show) return null;

  return (
    <section className="card space-y-3 border-primary/25 bg-gradient-to-l from-primary-light/50 to-transparent p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">من 1 إلى 10 — كيف تقيم تجربتك مع منارة؟ ⭐</h2>
          <p className="mt-1 text-xs text-slate-500">رأيك يحدد خارطة التطوير القادمة — دقيقة واحدة فقط.</p>
        </div>
        <button onClick={dismiss} className="text-xs text-slate-400 hover:text-slate-600">لاحقاً</button>
      </div>
      <div className="flex flex-wrap gap-1.5" dir="ltr">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button key={n} type="button" onClick={() => setScore(n)}
            className={`h-9 w-9 rounded-lg text-small font-bold ${score === n ? "bg-primary text-white" : "bg-white text-slate-500 shadow-sm"}`}>{n}</button>
        ))}
      </div>
      {score > 0 && score <= 6 && (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="ما أهم شيء نحسّنه؟ (اختياري — ونتواصل معك شخصياً خلال يوم)"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small outline-none focus:border-primary" />
      )}
      {score >= 9 && (
        <p className="rounded-xl bg-success/10 px-4 py-2 text-xs font-bold text-success">
          🎉 سعيدون بك! لو تعرف معلماً يستفيد — رشّحه من بطاقة الإحالة بالأسفل واكسبا معاً.
        </p>
      )}
      <button onClick={send} disabled={!score || busy} className="btn-primary !py-2 text-small disabled:opacity-50">
        {busy ? "جاري..." : "إرسال التقييم"}
      </button>
    </section>
  );
}
