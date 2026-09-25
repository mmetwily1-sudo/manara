"use client";

import { useEffect, useState } from "react";

function urlB64ToU8(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** زر تفعيل إشعارات الجهاز (غياب/نتائج حتى والتطبيق مقفول) */
export function PushSubscribeButton() {
  const [state, setState] = useState<"unknown" | "unsupported" | "denied" | "off" | "on" | "busy" | "err">("unknown");
  const [msg, setMsg] = useState("");

  async function refresh() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState("unsupported"); return; }
      if (Notification.permission === "denied") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch { setState("err"); }
  }
  useEffect(() => { refresh(); }, []);

  async function enable() {
    setState("busy"); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const rk = await fetch("/api/push/public-key").then((r) => r.json().catch(() => null));
      if (!rk?.ok || !rk.key) { setState("err"); setMsg("خدمة الإشعارات غير مهيأة بعد."); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(rk.key) as any });
      }
      const r = await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (r.ok) setState("on");
      else { setState("err"); setMsg("تعذر الحفظ — حاول مجدداً."); }
    } catch { setState("err"); setMsg("تعذر التفعيل على هذا المتصفح."); }
  }

  if (state === "unknown") return null;
  if (state === "unsupported") return <p className="text-xs text-slate-400">متصفحك لا يدعم إشعارات الأجهزة.</p>;
  if (state === "denied") return <p className="text-xs text-slate-400">الإشعارات محظورة من إعدادات المتصفح — فعّلها لتصلك التنبيهات.</p>;
  if (state === "on") return <p className="text-xs font-bold text-success">🔔 إشعارات الجهاز مفعّلة — ستصلك التنبيهات حتى والتطبيق مقفول.</p>;

  return (
    <div className="space-y-2">
      <button onClick={enable} disabled={state === "busy"} className="btn-primary text-small disabled:opacity-50">
        {state === "busy" ? "جاري التفعيل..." : "فعّل إشعارات الجهاز 🔔"}
      </button>
      {msg && <p className="text-xs font-bold text-danger">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-slate-400">تنبيه الغياب والنتيجة والدفعة — تصلك حتى لو التطبيق مقفول (حسب سماح نظام جهازك).</p>
    </div>
  );
}
