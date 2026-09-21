"use client";

import { useEffect, useState } from "react";

type Ann = { id: string; group_name: string; body: string; sender: string; created_at: string | null };

export default function AnnouncementsPage() {
  const [list, setList] = useState<Ann[] | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ group_id: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/announcements", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.announcements ?? []);
    } catch {}
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups((j.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: form.group_id || null, body: form.body }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsg("تم النشر 📢"); setForm({ group_id: "", body: "" }); load(); }
      else setMsg(j?.message ?? "فشل النشر.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">الإعلانات 📢</h1>
        <p className="mt-1 text-small text-slate-500">انشر للسنتر كله أو لمجموعة — تظهر للطلاب فوراً.</p>
      </header>
      {msg && <p className="card p-3 text-small font-bold text-primary">{msg}</p>}
      <form onSubmit={post} className="card space-y-3 p-5">
        <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <option value="">📢 عام — كل السنتر</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={3}
          placeholder="اكتب الإعلان..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <button className="btn-primary" disabled={busy}>{busy ? "جاري النشر..." : "نشر الإعلان"}</button>
      </form>
      {list === null ? <div className="card p-8 text-center text-slate-400">جاري التحميل...</div> : (
        <ul className="space-y-3">
          {list.length === 0 && <li className="card p-6 text-center text-small text-slate-500">لا إعلانات بعد.</li>}
          {list.map((a) => (
            <li key={a.id} className="card p-4">
              <div className="text-small leading-relaxed">{a.body}</div>
              <div className="mt-2 text-xs text-slate-400">{a.group_name}{a.created_at ? ` · ${new Date(a.created_at).toLocaleString("ar-EG")}` : ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
