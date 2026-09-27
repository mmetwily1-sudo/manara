"use client";

import { useEffect, useState } from "react";

type C = { id: string; student: string; status: string; started_at: string | null; expires_at: string | null; submitted_at: string | null };

/** إدارة أكواد امتحان: الحالات + وقت إضافي فردي */
export default function CodesPage({ params }: { params: { id: string } }) {
  const [codes, setCodes] = useState<C[] | null>(null);
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const r = await fetch(`/api/exams/${params.id}/codes`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setCodes(j.codes);
    } catch {}
  }
  useEffect(() => { load(); }, [params.id]);

  async function extend(id: string) {
    setBusy(id);
    try {
      const r = await fetch(`/api/exams/${params.id}/codes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_id: id, extra_minutes: 15 }),
      });
      if (r.ok) load();
    } catch {}
    finally { setBusy(""); }
  }

  const ST: Record<string, string> = { available: "متاح ⚪", started: "بدأ 🟢", submitted: "سلّم ✅", expired: "انتهى ⚫" };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-h1">أكواد الدخول 🔐</h1>
      {codes === null ? <div className="card p-8 text-center text-slate-400">جاري التحميل...</div> :
        codes.length === 0 ? <div className="card p-8 text-center text-small text-slate-500">لا أكواد مولدة لهذا الامتحان بعد.</div> : (
        <ul className="space-y-2">
          {codes.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <span className="font-bold">{c.student}</span>
                <span className="mx-2 text-xs">{ST[c.status] ?? c.status}</span>
                {c.expires_at && c.status === "started" && (
                  <span className="text-xs text-slate-400" dir="ltr">ينتهي {new Date(c.expires_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
              {c.status === "started" && (
                <button onClick={() => extend(c.id)} disabled={busy === c.id}
                  className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50">
                  {busy === c.id ? "..." : "+15 دقيقة ⏱️"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
