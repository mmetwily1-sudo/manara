"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** نموذج تصميم المالك: لون الإدارة + قفل السناتر */
export function DesignForm({ initial }: { initial: { admin_accent: string; lock_tenant_design: boolean } }) {
  const [accent, setAccent] = useState(initial.admin_accent ?? "");
  const [lock, setLock] = useState(!!initial.lock_tenant_design);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function save() {
    if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) { setMsg("اللون بصيغة #RRGGBB أو اتركه فارغاً"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/design", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_accent: accent || null, lock_tenant_design: lock }),
      });
      setMsg(r.ok ? "تم الحفظ ✅" : "فشل الحفظ");
      if (r.ok) router.refresh();
    } catch { setMsg("تعذر الاتصال"); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-small font-bold">لون لوحة الإدارة</label>
        <div className="flex items-center gap-2">
          <input value={accent} onChange={(e) => setAccent(e.target.value)} dir="ltr" maxLength={7}
            placeholder="فارغ = الأزرق"
            className="w-36 rounded-xl border-2 border-slate-200 px-3 py-2 font-mono text-small outline-none focus:border-primary" />
          {/^#[0-9a-fA-F]{6}$/.test(accent) && (
            <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: accent }} />
          )}
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <span className="text-small font-bold">🔒 قفل تخصيص ثيمات السناتر</span>
        <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="h-5 w-5" />
      </label>
      {msg && <p className="text-xs font-bold text-primary">{msg}</p>}
      <button onClick={save} disabled={busy} className="btn-primary !px-6 !py-2.5 text-small disabled:opacity-50">
        {busy ? "جاري..." : "حفظ التصميم"}
      </button>
    </div>
  );
}
