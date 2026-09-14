"use client";

import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { createClient } from "@/lib/supabase";

export function passkeySupported() {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).PublicKeyCredential !== "undefined"
  );
}

/** زر الدخول بالبصمة/الوجه في صفحة الدخول */
export function PasskeyLoginButton({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(passkeySupported());
    try {
      const last = localStorage.getItem("manara_last_email");
      if (last && !email) {
        // مجرد تلميح — الحقل نفسه يبقى تحت سيطرة الصفحة
      }
    } catch {}
  }, [email]);

  if (!supported) return null;

  async function handleLogin() {
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) {
      setErr("اكتب بريدك أولاً ثم اضغط دخول بالبصمة");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/passkey/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setErr(
          j?.error === "no_passkeys"
            ? "لا توجد بصمة مسجلة لهذا البريد — ادخل بكلمة السر أولاً ثم فعّلها من الإعدادات"
            : "تعذر بدء الدخول بالبصمة"
        );
        setBusy(false);
        return;
      }
      const authResp = await startAuthentication({ optionsJSON: j.options });
      const v = await fetch("/api/auth/passkey/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, authResp }),
      });
      const vj = await v.json().catch(() => null);
      if (!v.ok || !vj?.ok || !vj?.token) {
        setErr("فشل التحقق من البصمة — حاول مجدداً أو ادخل بكلمة السر");
        setBusy(false);
        return;
      }
      const sb = createClient();
      const { error } = await sb.auth.verifyOtp({ token_hash: vj.token, type: "magiclink" });
      if (error) {
        setErr("تعذر إتمام الجلسة — حاول مجدداً");
        setBusy(false);
        return;
      }
      try {
        localStorage.setItem("manara_last_email", em);
      } catch {}
      window.location.href = "/dashboard";
    } catch {
      setErr("حدث خطأ — حاول مجدداً");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleLogin}
        disabled={busy}
        className="btn-secondary flex w-full items-center justify-center gap-2"
      >
        <span aria-hidden>👆</span>
        {busy ? "بانتظار البصمة..." : "دخول بالبصمة / الوجه"}
      </button>
      {err && (
        <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{err}</p>
      )}
    </div>
  );
}
