"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { passkeySupported } from "./PasskeyLoginButton";

type Item = { id: string; name: string; createdAt: string };

/** إدارة البصمات: عرض + تفعيل + حذف */
export function PasskeyManager() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [supported, setSupported] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/auth/passkey");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setItems(j.passkeys);
    } catch {}
  }

  useEffect(() => {
    setSupported(passkeySupported());
    load();
  }, []);

  if (!supported) {
    return (
      <p className="text-xs text-slate-400">
        جهازك الحالي لا يدعم مفاتيح المرور — جرّب من موبايل حديث (أندرويد/آيفون).
      </p>
    );
  }

  async function enroll() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setMsg("تعذر بدء التسجيل — حاول مجدداً");
        setBusy(false);
        return;
      }
      const attResp = await startRegistration({ optionsJSON: j.options });
      const name = `بصمة ${new Date().toLocaleDateString("ar-EG")}`;
      const v = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attResp, name }),
      });
      const vj = await v.json().catch(() => null);
      if (v.ok && vj?.ok) {
        setMsg("تم تفعيل الدخول بالبصمة بنجاح 🎉");
        load();
      } else {
        setMsg(
          vj?.error === "expired_challenge"
            ? "انتهت صلاحية المحاولة — اضغط مجدداً"
            : "فشل تسجيل البصمة — حاول مجدداً"
        );
      }
    } catch {
      setMsg("أُلغيت العملية أو حدث خطأ — حاول مجدداً");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه البصمة؟ ستحتاج كلمة السر للدخول بعدها.")) return;
    try {
      await fetch("/api/auth/passkey", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      load();
    } catch {}
  }

  return (
    <div className="space-y-3">
      {items === null ? (
        <p className="text-xs text-slate-400">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">
          لم تفعّل الدخول السريع بعد — فعّله لتدخل ببصمة إصبعك أو وجهك بدل كلمة السر.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-xs font-bold">
                👆 {c.name} <span className="font-normal text-slate-400">· مفعّلة</span>
              </span>
              <button onClick={() => remove(c.id)} className="text-xs font-bold text-danger">
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={enroll} disabled={busy} className="btn-primary w-full !py-2.5 text-small">
        {busy ? "اتبع تعليمات جهازك..." : "+ تفعيل الدخول بالبصمة / الوجه"}
      </button>
      {msg && <p className="text-xs font-semibold text-slate-600">{msg}</p>}
    </div>
  );
}
