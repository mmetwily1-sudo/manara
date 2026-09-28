"use client";

import { useEffect, useState } from "react";

type Dev = { id: string; device_label: string; last_seen: string; trusted: boolean; revoked: boolean };

/** أجهزتي: عرض + إنهاء جهاز + إنهاء الكل عدا الحالي */
export function DevicesManager() {
  const [devs, setDevs] = useState<Dev[] | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/auth/devices", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      // المالك يرى الكل — نعرض أجهزتي فقط هنا (الأحدث غالباً الحالي)
      if (r.ok && j?.ok) {
        const all: Dev[] = j.devices ?? [];
        setDevs(all);
      }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function act(id: string | null, action: string) {
    if (action === "revoke_others" && !confirm("إنهاء كل الجلسات الأخرى؟ ستحتاج لتسجيل الدخول مجدداً عليها.")) return;
    const r = await fetch("/api/auth/devices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "revoke_others" ? { action, except_id: id } : { id, action }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg(action === "revoke_others" ? `تم إنهاء ${j.revoked ?? 0} جهاز.` : "تم."); load(); }
    else setMsg("غير مصرح — هذه الإجراءات للمالك في صفحة الفريق.");
  }

  if (devs === null) return null;
  const current = devs.filter((d) => !d.revoked).sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)))[0];
  return (
    <div>
      <h2 className="font-bold">أجهزتي 🖥️</h2>
      <div className="mt-3 space-y-2">
        {devs.length === 0 && <div className="text-xs text-slate-400">لا أجهزة مسجلة.</div>}
        {devs.slice(0, 10).map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-small">
            <span>{d.device_label} {current?.id === d.id && <span className="text-xs text-success">(الحالي)</span>}</span>
            <span className="flex items-center gap-2">
              {d.revoked ? <span className="text-xs font-bold text-danger">منتهي</span>
                : d.trusted ? <span className="text-xs font-bold text-success">موثوق</span>
                : <span className="text-xs font-bold text-warning">جديد</span>}
              {!d.revoked && current?.id !== d.id && (
                <button onClick={() => act(d.id, "revoke")} className="text-xs font-bold text-danger">إنهاء</button>
              )}
            </span>
          </div>
        ))}
        {current && (
          <button onClick={() => act(current.id, "revoke_others")} className="btn-secondary w-full text-small">
            إنهاء كل الجلسات الأخرى ⛔
          </button>
        )}
        {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      </div>
    </div>
  );
}
