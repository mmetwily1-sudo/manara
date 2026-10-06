"use client";

import { useRef, useState } from "react";

/** زر رفع صورة موقع السنتر — يرجع الرابط العام عبر onDone */
export function AssetUpload({ onDone, label }: { onDone: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/tenant/assets", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.url) { onDone(j.url); }
      else setMsg(j?.message ?? "فشل الرفع");
    } catch { setMsg("تعذر الاتصال"); }
    setBusy(false);
    try { if (ref.current) ref.current.value = ""; } catch {}
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={pick} aria-label="رفع صورة" />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="rounded-xl bg-primary-light px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50">
        {busy ? "جاري الرفع..." : (label ?? "📤 رفع صورة")}
      </button>
      {msg && <span className="text-[11px] font-bold text-danger">{msg}</span>}
    </span>
  );
}
