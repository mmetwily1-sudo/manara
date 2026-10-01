"use client";

import { useEffect, useState } from "react";

type Ev = { kind: string; label: string; enabled: boolean };

/** قواعد الإشعارات: تفعيل/إيقاف كل نوع (مالك) */
export function NotifyRulesManager() {
  const [events, setEvents] = useState<Ev[] | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/tenant/notify-rules", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setEvents(j.events ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function toggle(kind: string, enabled: boolean) {
    const r = await fetch("/api/tenant/notify-rules", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, enabled }),
    });
    if (r.ok) load();
  }

  if (events === null) return null;
  return (
    <div>
      <h2 className="font-bold">قواعد الإشعارات 🔕</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">تحكم في كل نوع — الموقوف لا يُرسل ولا يُسجل.</p>
      <div className="mt-3 space-y-2">
        {events.map((e) => (
          <div key={e.kind} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-small">
            <span className="font-bold">{e.label}</span>
            <button onClick={() => toggle(e.kind, !e.enabled)}
              className={`rounded-full px-4 py-1 text-xs font-bold text-white ${e.enabled ? "bg-success" : "bg-slate-300"}`}>
              {e.enabled ? "مفعلة" : "موقوفة"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
