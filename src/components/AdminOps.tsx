"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** أزرار إحياء/إعادة — بتأكيد صريح. */
export function ReviveJob({ jobId }: { jobId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function go() {
    if (!confirm("إحياء هذه المهمة وإعادتها للطابور؟")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/worker/retry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!r.ok) alert("فشل الإحياء");
      router.refresh();
    } catch { alert("تعذر الاتصال"); }
    setBusy(false);
  }
  return <button onClick={go} disabled={busy} className="rounded-lg bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-50">إحياء</button>;
}

export function ResendNotif({ logId }: { logId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function go() {
    if (!confirm("إعادة إرسال هذا التنبيه؟ (dedupe يمنع التكرار)")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/notify/retry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) alert(j?.error === "already_sent" ? "أُرسل بالفعل" : "فشل");
      router.refresh();
    } catch { alert("تعذر الاتصال"); }
    setBusy(false);
  }
  return <button onClick={go} disabled={busy} className="rounded-lg bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-50">إعادة إرسال</button>;
}
