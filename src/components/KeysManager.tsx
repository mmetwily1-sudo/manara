"use client";

import { useEffect, useState } from "react";

type Key = { id: string; name: string; key_prefix: string; revoked: boolean; last_used_at: string | null };

/** مفاتيح API للمطورين: إصدار (يظهر مرة) + إلغاء */
export function KeysManager() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/developers/keys", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setKeys(j.keys ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/developers/keys", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setFresh(j.key); setName(""); load(); }
  }

  async function toggle(id: string, revoked: boolean) {
    const r = await fetch("/api/developers/keys", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, revoked }),
    });
    if (r.ok) load();
  }

  if (keys === null) return null;
  return (
    <div>
      <h2 className="font-bold">مفاتيح API 🔑</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">للتكاملات الخارجية — مثال: <code dir="ltr">GET /api/public/summary?key=mk_...</code></p>
      <form onSubmit={create} className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المفتاح (موقع السنتر...)" required maxLength={80}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <button className="btn-primary !py-2 text-small">إصدار</button>
      </form>
      {fresh && (
        <div className="mt-2 rounded-xl bg-warning/10 p-3">
          <div className="text-xs font-bold">انسخه الآن — لن يظهر مجدداً:</div>
          <div className="mt-1 break-all rounded-lg bg-white p-2 font-mono text-small font-bold" dir="ltr">{fresh}</div>
        </div>
      )}
      {keys.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-small">
              <span><b>{k.name}</b> <code dir="ltr" className="text-xs text-slate-400">{k.key_prefix}...</code>
                {k.last_used_at && <span className="text-[11px] text-slate-400"> · آخر استخدام {new Date(k.last_used_at).toLocaleDateString("ar-EG")}</span>}</span>
              <button onClick={() => toggle(k.id, !k.revoked)}
                className={`text-xs font-bold ${k.revoked ? "text-success" : "text-danger"}`}>
                {k.revoked ? "استعادة" : "إلغاء"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
