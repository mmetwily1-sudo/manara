"use client";

import { useState } from "react";

type Tg = { on: boolean; linked?: boolean; url?: string | null };

/**
 * خطوات تسجيل ولي الأمر (بعد الدخول بالرابط السحري مباشرة):
 * 1) ترحيب 2) تفعيل Push بضغطة 3) ربط تليجرام بضغطة 4) دخول البوابة.
 * كل خطوة قابلة للتخطي — والبوابة تعمل بدونها (الصندوق الداخلي يغطي الكل).
 */
export function ParentOnboarding(props: {
  studentName: string;
  centerName: string;
  telegram: Tg;
  onCheckTelegram: () => Promise<boolean>;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tgLinked, setTgLinked] = useState(!!props.telegram.linked);

  function finish() {
    try { localStorage.setItem("manara_parent_onboarded", "1"); } catch {}
    props.onDone();
  }

  async function enablePush() {
    setBusy(true); setMsg("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("جهازك لا يدعم الإشعارات — أكمل بدونه.");
        setBusy(false);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStep(2); setBusy(false); return; }
      const rk = await fetch("/api/push/public-key").then((r) => r.json().catch(() => null));
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub && rk?.key) {
        const pad = "=".repeat((4 - (rk.key.length % 4)) % 4);
        const b64 = (rk.key + pad).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64);
        const key = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as any });
      }
      if (sub) {
        const r = await fetch("/api/push/subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        if (!r.ok) setMsg("تعذر الحفظ — يمكنك التفعيل لاحقاً من البوابة.");
      }
      setStep(2);
    } catch { setMsg("تعذر التفعيل على هذا الجهاز — أكمل بدونه."); }
    setBusy(false);
  }

  async function checkTg() {
    setBusy(true); setMsg("");
    try {
      const linked = await props.onCheckTelegram();
      setTgLinked(linked);
      if (linked) finish();
      else setMsg("لم يتم الرصد بعد — اضغط START في البوت ثم أعد التحقق.");
    } catch { setMsg("تعذر التحقق — حاول تاني."); }
    setBusy(false);
  }

  const dots = [0, 1, 2].map((i) => (
    <span key={i} className={`h-2 w-2 rounded-full ${i <= step ? "bg-primary" : "bg-slate-200"}`} />
  ));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-16">
      <div className="card w-full space-y-4 p-8 text-center">
        <div className="flex justify-center gap-1.5">{dots}</div>

        {step === 0 && (
          <>
            <div className="text-h1">🎓</div>
            <h1 className="text-h1">أهلاً بك في {props.centerName}</h1>
            <p className="text-small text-slate-600">
              بوابة متابعة <b>{props.studentName}</b>: الحضور والدرجات والمصروفات والتنبيهات — في 3 خطوات سريعة.
            </p>
            <button onClick={() => setStep(1)} className="btn-primary w-full">ابدأ التفعيل (دقيقة واحدة) 🚀</button>
            <button onClick={finish} className="w-full text-center text-xs font-bold text-slate-400">تخطي — ادخل البوابة مباشرة</button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="text-h1">🔔</div>
            <h1 className="text-h1">فعّل تنبيهات الغياب والنتائج</h1>
            <p className="text-small text-slate-600">ضغطة واحدة — وتصلك التنبيهات على جهازك حتى والتطبيق مقفول، مجاناً.</p>
            {msg && <p className="text-xs font-bold text-danger">{msg}</p>}
            <button onClick={enablePush} disabled={busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? "جاري..." : "فعّل التنبيهات 🔔"}
            </button>
            <button onClick={() => setStep(2)} className="w-full text-center text-xs font-bold text-slate-400">تخطي هذه الخطوة</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-h1">📨</div>
            <h1 className="text-h1">اربط تليجرام للتنبيهات المجانية</h1>
            {props.telegram.on && props.telegram.url && !tgLinked ? (
              <>
                <p className="text-small text-slate-600">اضغط الزر، ثم اضغط START في البوت — ويتم الربط تلقائياً.</p>
                <a href={props.telegram.url} target="_blank" rel="noopener noreferrer" className="btn-primary block w-full !py-3">
                  افتح البوت واربط 📨
                </a>
                {msg && <p className="text-xs font-bold text-danger">{msg}</p>}
                <button onClick={checkTg} disabled={busy} className="btn-secondary w-full !py-2.5 text-small disabled:opacity-50">
                  {busy ? "جاري التحقق..." : "تحققت — ضغطت START ✅"}
                </button>
              </>
            ) : tgLinked ? (
              <p className="text-small font-bold text-success">✅ مربوط — ممتاز!</p>
            ) : (
              <p className="text-small text-slate-600">ربط تليجرام غير متاح حالياً — أكمل بدونه.</p>
            )}
            <button onClick={finish} className="btn-primary w-full">ادخل البوابة 🎉</button>
          </>
        )}
      </div>
    </main>
  );
}
