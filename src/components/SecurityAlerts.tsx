"use client";

import { useEffect, useState } from "react";

type Alert = { id: string; name: string; label: string; status: string; created_at: string };

/** تنبيهات الدخول الغريب: جهاز/IP جديد */
export function SecurityAlerts() {
  const [rows, setRows] = useState<Alert[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/security/alerts", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setRows(j.rows ?? []); setIsOwner(!!j.isOwner); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function seen(id?: string) {
    const r = await fetch("/api/security/alerts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    if (r.ok) load();
  }

  if (rows === null) return null;
  const fresh = rows.filter((a) => a.status === "new");
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">تنبيهات الدخول ⚠️ {fresh.length > 0 && (
          <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] text-white">{fresh.length} جديدة</span>
        )}</h2>
        {fresh.length > 0 && <button onClick={() => seen()} className="text-xs font-bold text-primary">تعليم الكل كمقروء</button>}
      </div>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <div className="text-xs text-slate-400">لا تنبيهات — كل الدخول مألوف ✅</div>}
        {rows.slice(0, 15).map((a) => (
          <div key={a.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-small ${a.status === "new" ? "bg-danger/5" : "bg-slate-50"}`}>
            <span dir="auto">{a.label} {isOwner && a.name && <span className="text-xs text-slate-400">({a.name})</span>}</span>
            {a.status === "new"
              ? <button onClick={() => seen(a.id)} className="shrink-0 text-xs font-bold text-primary">شاهدت</button>
              : <span className="shrink-0 text-xs text-slate-400">مقروء</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
