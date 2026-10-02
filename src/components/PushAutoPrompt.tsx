"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/**
 * لافتة تفعيل الإشعارات لولي الأمر/الطالب — تظهر تلقائياً أول زيارة فقط.
 * (صلاحية المتصفح per-device بقانون الويب — لا يمكن تفعيلها نيابة عن العميل،
 * لكن ضغطة واحدة منه تكفي للأبد على جهازه.)
 */
export function PushAutoPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        if (localStorage.getItem("manara_push_prompted")) return;
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        if (Notification.permission !== "default") return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!stop && !sub) setShow(true);
      } catch {}
    })();
    return () => { stop = true; };
  }, []);

  function dismiss() {
    try { localStorage.setItem("manara_push_prompted", "1"); } catch {}
    setShow(false);
  }

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { dismiss(); setBusy(false); return; }
      const sb = createClient();
      void sb;
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
        await fetch("/api/push/subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      }
    } catch {}
    dismiss();
    setBusy(false);
  }

  if (!show) return null;
  return (
    <div className="card space-y-2 border-primary/30 bg-primary-light/50 p-4">
      <p className="text-small font-bold">🔔 فعّل تنبيهات الغياب والنتائج والمصروفات</p>
      <p className="text-xs text-slate-600">ضغطة واحدة — وتصلك التنبيهات على جهازك حتى والتطبيق مقفول، مجاناً.</p>
      <div className="flex gap-2">
        <button onClick={enable} disabled={busy} className="btn-primary flex-1 !py-2 text-small disabled:opacity-50">
          {busy ? "جاري..." : "فعّل الآن 🔔"}
        </button>
        <button onClick={dismiss} className="btn-secondary !px-4 !py-2 text-small">لاحقاً</button>
      </div>
    </div>
  );
}
