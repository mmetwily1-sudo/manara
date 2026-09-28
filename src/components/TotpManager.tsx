"use client";

import { useEffect, useState } from "react";

/** التحقق بخطوتين TOTP للمالك (Google Authenticator) */
export function TotpManager() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/auth/totp", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setEnabled(!!j.enabled);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function setup() {
    const r = await fetch("/api/auth/totp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "setup" }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setSecret(j.secret); setMsg(j.hint); }
  }

  async function enable() {
    const r = await fetch("/api/auth/totp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "enable", code }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setEnabled(true); setSecret(""); setCode(""); setMsg("تم التفعيل ✅"); }
    else setMsg("كود خطأ — تحقق من الوقت والتطبيق.");
  }

  async function disable() {
    const r = await fetch("/api/auth/totp", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "disable", code }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setEnabled(false); setCode(""); setMsg("تم الإيقاف."); }
    else setMsg("كود خطأ.");
  }

  if (enabled === null) return null;
  return (
    <div>
      <h2 className="font-bold">التحقق بخطوتين 🔐</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        كود من تطبيق Authenticator عند اعتماد الرواتب والإجراءات الحساسة.
      </p>
      <div className="mt-3 space-y-2">
        <div className="text-small">الحالة: {enabled ? <b className="text-success">مفعلة ✅</b> : <b className="text-slate-400">متوقفة</b>}</div>
        {!enabled && !secret && <button onClick={setup} className="btn-secondary text-small">بدء الإعداد</button>}
        {!enabled && secret && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <div className="text-xs">انسخ السر في التطبيق:</div>
            <div className="rounded-lg bg-white p-2 font-mono text-small font-bold" dir="ltr">{secret}</div>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="كود 6 أرقام" inputMode="numeric" dir="ltr" maxLength={6}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-small" />
              <button onClick={enable} className="btn-primary !py-2 text-small">تفعيل</button>
            </div>
          </div>
        )}
        {enabled && (
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="كود للإيقاف" inputMode="numeric" dir="ltr" maxLength={6}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <button onClick={disable} className="btn-secondary text-small">إيقاف</button>
          </div>
        )}
        {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      </div>
    </div>
  );
}
