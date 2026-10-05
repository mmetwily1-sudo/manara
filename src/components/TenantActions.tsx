"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** أفعال المالك على السنتر: تعليق/تفعيل/باقة/تمديد — بتأكيد صريح. */
export function TenantActions({ tenantId, name, status }: { tenantId: string; name: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState("");
  const router = useRouter();

  async function act(action: string, value?: string) {
    const label = action === "suspend" ? `تعليق ${name}؟ (يتوقف دخول السنتر فوراً)` : action === "activate" ? `تفعيل ${name}؟` : action === "extend30" ? `تمديد تجربة ${name} 30 يوماً؟` : action === "reset_design" ? `إعادة ثيم موقع ${name} للافتراضي؟` : `تغيير باقة ${name} إلى ${value}؟`;
    if (!confirm(label)) return;
    const reason = (prompt("سبب إلزامي (يُسجل في التدقيق):", "") ?? "").trim();
    if (!reason) { alert("السبب إلزامي"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/tenants/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, action, value, reason }),
      });
      if (!r.ok) alert("فشل التنفيذ");
      router.refresh();
    } catch { alert("تعذر الاتصال"); }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "active" ? (
        <button onClick={() => act("suspend")} disabled={busy} className="rounded-lg bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger disabled:opacity-50">تعليق</button>
      ) : (
        <button onClick={() => act("activate")} disabled={busy} className="rounded-lg bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success disabled:opacity-50">تفعيل</button>
      )}
      <button onClick={() => act("extend30")} disabled={busy} className="rounded-lg bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-50">+30 يوم</button>
      <button onClick={() => act("reset_design")} disabled={busy} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 disabled:opacity-50">🎨 افتراضي</button>
      <select value={plan} onChange={(e) => { const v = e.target.value; setPlan(""); if (v) act("plan", v); }} disabled={busy}
        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold">
        <option value="">الباقة…</option>
        {["trial", "basic", "pro", "enterprise"].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}
