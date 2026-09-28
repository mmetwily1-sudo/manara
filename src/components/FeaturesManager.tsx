"use client";

import { useEffect, useState } from "react";

type F = { key: string; label: string; enabled: boolean };

/** مزايا السنتر: تفعيل/إيقاف الوحدات (مالك) */
export function FeaturesManager() {
  const [features, setFeatures] = useState<F[] | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/features", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setFeatures(j.features ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function toggle(key: string, enabled: boolean) {
    const r = await fetch("/api/features", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, enabled }),
    });
    if (r.ok) load();
  }

  if (features === null) return null;
  return (
    <div>
      <h2 className="font-bold">مزايا السنتر 🧩</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">أوقف وحدة لا تستخدمها — تختفي عن الطلاب فوراً.</p>
      <div className="mt-3 space-y-2">
        {features.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-small">
            <span className="font-bold">{f.label}</span>
            <button onClick={() => toggle(f.key, !f.enabled)}
              className={`rounded-full px-4 py-1 text-xs font-bold text-white ${f.enabled ? "bg-success" : "bg-slate-300"}`}>
              {f.enabled ? "مفعلة" : "موقوفة"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
