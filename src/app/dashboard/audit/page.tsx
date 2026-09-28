"use client";

import { useEffect, useState } from "react";

type Row = { id: string; actor: string; action: string; entity_type: string; entity_id: string; details: any; created_at: string };

/** سجل التدقيق: من فعل ماذا ومتى — بفلاتر */
export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setRows(j.rows ?? []); setGroups(j.groups ?? []); }
      else if (r.status === 403) setErr("للمالك فقط.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">سجل التدقيق 🕵️</h1>
        <p className="mt-1 text-small text-slate-500">كل إجراء حساس: الفاعل + الفعل + الوقت</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="card flex flex-wrap gap-2 p-4">
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
          <option value="">كل الأنواع</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في السجل..."
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
        <button className="btn-secondary text-small">بحث 🔍</button>
      </form>
      <section className="card overflow-hidden">
        <table className="w-full text-right text-small">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{["الوقت", "الفاعل", "الفعل", "الكيان", "التفاصيل"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-400" dir="ltr">{new Date(r.created_at).toLocaleString("ar-EG")}</td>
                <td className="px-4 py-2 font-bold">{r.actor || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs" dir="ltr">{r.action}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{r.entity_type} {r.entity_id?.slice(0, 8)}</td>
                <td className="max-w-64 truncate px-4 py-2 text-xs text-slate-400" dir="ltr">{JSON.stringify(r.details)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">لا سجلات.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
