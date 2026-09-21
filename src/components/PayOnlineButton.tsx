"use client";

import { useState } from "react";

/** زر «ادفع أونلاين» — يفتح بوابة Paymob في تبويب جديد (يتطلب دخول المعلم). */
export function PayOnlineButton({ plan, label }: { plan: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function pay() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/billing/pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.iframe_url) {
        window.open(j.iframe_url, "_blank", "noopener");
      } else if (r.status === 401 || j?.error === "unauth") {
        window.location.href = "/join";
      } else {
        setMsg(j?.message ?? "الدفع الأونلاين غير مفعل بعد — تواصل واتساب.");
      }
    } catch {
      setMsg("تعذر الاتصال بالخادم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="block">
      <button onClick={pay} disabled={busy} className="mt-2 w-full rounded-xl border-2 border-success/40 px-4 py-2 text-small font-bold text-success transition hover:bg-success/10 disabled:opacity-50">
        {busy ? "جاري تجهيز الدفع..." : (label ?? "💳 ادفع أونلاين")}
      </button>
      {msg && <span className="mt-1 block text-center text-xs font-bold text-warning">{msg}</span>}
    </span>
  );
}
