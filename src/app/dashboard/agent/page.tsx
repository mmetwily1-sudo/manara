"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string; steps?: { tool: string; ok: boolean }[] };

const TOOL_AR: Record<string, string> = { bank_stats: "إحصاء البنك", create_exam: "إنشاء امتحان", list_exams: "قائمة الامتحانات" };

export default function AgentPage() {
  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    try {
      const r = await fetch("/api/agent/threads", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setThreads(j.threads ?? []);
    } catch {}
  }
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput(""); setErr(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", text }]);
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, message: text }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        if (!threadId && j.thread_id) { setThreadId(j.thread_id); loadThreads(); }
        setMsgs((p) => [...p, { role: "assistant", text: j.text, steps: j.steps ?? [] }]);
      } else setErr(j?.message ?? "فشل: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  function fresh() { setThreadId(null); setMsgs([]); setErr(""); }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="card hidden h-fit p-3 lg:block">
        <button onClick={fresh} className="btn-secondary mb-2 w-full text-small">+ محادثة جديدة</button>
        <ul className="space-y-1">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => { setThreadId(t.id); setMsgs([]); setErr(""); }}
                className={`w-full rounded-lg px-3 py-2 text-right text-small transition hover:bg-slate-100 ${threadId === t.id ? "bg-primary-light font-bold text-primary" : "text-slate-600"}`}>
                {t.title}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">مساعدك يبني من بنكك فقط — والنشر دائماً بيدك.</p>
      </aside>

      <div className="card flex min-h-[60vh] flex-col p-4">
        <header className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h1 className="font-bold">مساعد منارة 🤖</h1>
          <button onClick={fresh} className="text-xs font-bold text-primary lg:hidden">+ جديدة</button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {msgs.length === 0 && (
            <div className="space-y-2 text-center text-small text-slate-500">
              <p className="text-3xl">🤖</p>
              <p>جرّب: «اعمل امتحان علوم 5 أسئلة» أو «عندنا إيه في البنك؟»</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-small leading-relaxed ${m.role === "user" ? "mr-auto bg-primary text-white" : "bg-slate-100"}`}>
              <div className="whitespace-pre-wrap">{m.text}</div>
              {(m.steps ?? []).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(m.steps ?? []).map((s, k) => (
                    <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.ok ? "bg-success/15 text-success" : "bg-danger/10 text-danger"}`}>
                      🔧 {TOOL_AR[s.tool] ?? s.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="w-fit rounded-2xl bg-slate-100 px-4 py-2.5 text-small text-slate-500">يفكر ويستخدم أدواته…</div>}
          <div ref={bottom} />
        </div>
        {err && <p className="pb-2 text-small font-bold text-danger">{err}</p>}
        <form onSubmit={send} className="flex gap-2 border-t border-slate-100 pt-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب طلبك..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <button className="btn-primary" disabled={busy || !input.trim()}>{busy ? "..." : "إرسال"}</button>
        </form>
      </div>
    </div>
  );
}
