"use client";

import { useEffect, useState } from "react";

type T = { id: string; thread_id: string; peer: string; last: string; at: string | null; unreadMine: boolean };
type M = { id: string; body: string; mine: boolean; at: string };

/** بريد المعلم: محادثات الطلاب + رد */
export default function MessagesPage() {
  const [threads, setThreads] = useState<T[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/dm");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setThreads(j.threads);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function openT(id: string) {
    setOpen(id); setMsgs([]);
    try {
      const r = await fetch(`/api/dm/${id}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsgs(j.messages); load(); }
    } catch {}
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!open || !text.trim()) return;
    try {
      const r = await fetch("/api/dm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: open, body: text }),
      });
      if (r.ok) { setText(""); openT(open); }
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">رسائل الطلاب 💬</h1>
        <p className="mt-1 text-small text-slate-500">محادثات مباشرة مع طلاب مجموعاتك فقط</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {threads === null ? <div className="card p-6 text-center text-slate-400">جاري التحميل...</div> :
            threads.length === 0 ? <div className="card p-6 text-center text-small text-slate-500">لا محادثات بعد.</div> :
            threads.map((t) => (
              <li key={t.thread_id}>
                <button onClick={() => openT(t.thread_id)}
                  className={`w-full rounded-xl border p-4 text-right ${open === t.thread_id ? "border-primary bg-primary-light/40" : "border-slate-200/70 bg-surface"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-small font-bold">{t.peer}</span>
                    {t.unreadMine && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">جديدة</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500" dir="auto">{t.last}</div>
                </button>
              </li>
            ))}
        </ul>
        <div className="card space-y-2 p-4">
          {!open ? <div className="p-6 text-center text-small text-slate-400">اختر محادثة.</div> : (
            <>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {msgs.map((m) => (
                  <div key={m.id} className={`rounded-xl px-3 py-2 text-small ${m.mine ? "bg-primary-light/60" : "bg-slate-50"}`}>
                    <div dir="auto">{m.body}</div>
                  </div>
                ))}
                {msgs.length === 0 && <div className="text-small text-slate-400">لا رسائل بعد.</div>}
              </div>
              <form onSubmit={send} className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
                  placeholder="اكتب ردك..." className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
                <button className="btn-primary !px-4 !py-2 text-xs">إرسال</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
