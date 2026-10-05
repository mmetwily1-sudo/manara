"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** تشغيل العامل الخلفي فوراً (بدل انتظار الدورة) — بقفل idempotency من الخادم. */
export function ForceWorker() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function go() {
    if (!confirm("تشغيل دورة العامل الآن؟")) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/worker/run", { method: "POST" });
      const j = await r.json().catch(() => null);
      setMsg(r.ok && j?.ok ? `تم: نفذ ${j.ran ?? 0} (نجح ${j.done ?? 0})` : "تعذر — تحقق من الدخول");
      router.refresh();
    } catch { setMsg("تعذر الاتصال"); }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={go} disabled={busy} className="btn-secondary !px-4 !py-2 text-small disabled:opacity-50">
        {busy ? "جاري..." : "▶ تشغيل العامل الآن"}
      </button>
      {msg && <span className="text-xs font-bold text-primary">{msg}</span>}
    </div>
  );
}
