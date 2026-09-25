"use client";

import { useState } from "react";

/** صوت المعلم: تقييم سريع + اقتراح/بلاغ — يُقرأ في لوحة الأدمن */
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("idea");
  const [score, setScore] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, score: kind === "nps" ? score : null, text, page: window.location.pathname }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setDone(true); setOpen(false); }
      else setErr(j?.error === "too_many" ? "وصلت للحد اليومي — شكراً لنشاطك!" : "فشل الإرسال — حاول مجدداً.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <section className="card border-success/25 bg-success/5 p-4 text-small font-bold text-success">
        ✅ وصل صوتك — بنقرأ كل رسالة وبنطور على أساسها. شكراً!
      </section>
    );
  }

  return (
    <section className="card p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-small font-bold">
        <span>💬 صوتك يطور منارة — قيّم أو اقترح</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form onSubmit={send} className="mt-3 space-y-3">
          <div className="flex gap-2 text-xs">
            {[["nps", "تقييم"], ["idea", "اقتراح"], ["bug", "بلاغ"], ["praise", "شكر"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`rounded-full px-3 py-1.5 font-bold ${kind === k ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>{l}</button>
            ))}
          </div>
          {kind === "nps" && (
            <div className="flex flex-wrap gap-1.5" dir="ltr">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button key={n} type="button" onClick={() => setScore(n)}
                  className={`h-9 w-9 rounded-lg text-small font-bold ${score === n ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>{n}</button>
              ))}
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder={kind === "bug" ? "اشرح المشكلة وخطوات ظهورها..." : "اكتب رسالتك هنا..."}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-small outline-none focus:border-primary" />
          {err && <div className="text-xs font-bold text-danger">{err}</div>}
          <button disabled={busy || (kind === "nps" && !score)} className="btn-primary w-full !py-2 text-small disabled:opacity-50">
            {busy ? "جاري الإرسال..." : "إرسال"}
          </button>
        </form>
      )}
    </section>
  );
}
