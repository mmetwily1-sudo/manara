"use client";

import { useEffect, useState } from "react";

type T = { id: string; group: string; locked: boolean; replies: number; first: { body: string; sender: string } | null };
type M = { id: string; body: string; sender: string; mine: boolean; created_at: string };

/** منتدى المناقشات: مواضيع + ردود + إشراف (حذف/قفل) */
export default function ForumPage() {
  const [threads, setThreads] = useState<T[] | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [locked, setLocked] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/forum");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setThreads(j.threads); setIsTeacher(j.isTeacher); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function open(id: string) {
    setOpenId(id); setMsgs([]);
    try {
      const r = await fetch(`/api/forum/${id}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsgs(j.messages); setLocked(j.locked); }
    } catch {}
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/forum", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, body: form.body }),
      });
      if (r.ok) { setForm({ title: "", body: "" }); load(); }
    } catch {}
    finally { setBusy(false); }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!openId || !reply.trim()) return;
    try {
      const r = await fetch(`/api/forum/${openId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }),
      });
      if (r.ok) { setReply(""); open(openId); load(); }
    } catch {}
  }

  async function mod(action: string, message_id?: string) {
    if (!openId) return;
    try {
      const r = await fetch(`/api/forum/${openId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message_id }),
      });
      if (r.ok) { open(openId); load(); }
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">منتدى المناقشات 💬</h1>
        <p className="mt-1 text-small text-slate-500">اسأل وناقش — بإشراف المعلمين</p>
      </header>

      <form onSubmit={create} className="card space-y-2 p-5">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={150}
          placeholder="عنوان الموضوع..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={2} maxLength={2000}
          placeholder="نص المشاركة..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <button className="btn-primary !py-2 text-small" disabled={busy}>نشر الموضوع</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {threads === null ? <div className="card p-6 text-center text-slate-400">جاري التحميل...</div> :
            threads.length === 0 ? <div className="card p-6 text-center text-small text-slate-500">لا مواضيع بعد — ابدأ الأول.</div> :
            threads.map((t) => (
              <li key={t.id}>
                <button onClick={() => open(t.id)}
                  className={`w-full rounded-xl border p-4 text-right transition ${openId === t.id ? "border-primary bg-primary-light/40" : "border-slate-200/70 bg-surface"}`}>
                  <div className="text-small font-bold" dir="auto">{t.first?.body.split("\n")[0].replace(/\*\*/g, "") ?? ""} {t.locked && "🔒"}</div>
                  <div className="mt-1 text-xs text-slate-400">{t.group} · {t.first?.sender ?? ""} · {t.replies} رد</div>
                </button>
              </li>
            ))}
        </ul>
        <div className="card space-y-2 p-4">
          {!openId ? <div className="p-6 text-center text-small text-slate-400">اختر موضوعاً لعرض الردود.</div> : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">{msgs.length} رسالة {locked && "· مغلق 🔒"}</span>
                {isTeacher && (
                  <button onClick={() => mod(locked ? "unlock" : "lock")} className="text-xs font-bold text-primary">
                    {locked ? "فتح 🔓" : "قفل 🔒"}
                  </button>
                )}
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {msgs.map((m) => (
                  <div key={m.id} className={`rounded-xl px-3 py-2 text-small ${m.mine ? "bg-primary-light/60" : "bg-slate-50"}`}>
                    <div className="text-[11px] font-bold text-slate-400">{m.sender}{m.mine ? " (أنت)" : ""}</div>
                    <div dir="auto">{m.body}</div>
                    {isTeacher && !m.mine && (
                      <button onClick={() => mod("delete_msg", m.id)} className="mt-1 text-[11px] text-danger">حذف 🗑️</button>
                    )}
                  </div>
                ))}
              </div>
              {(!locked || isTeacher) && (
                <form onSubmit={sendReply} className="flex gap-2">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000}
                    placeholder="اكتب ردك..." className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
                  <button className="btn-primary !px-4 !py-2 text-xs">إرسال</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
