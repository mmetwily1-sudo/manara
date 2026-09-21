"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string; steps?: { tool: string; ok: boolean }[]; suggest?: string[] };

const TOOL_AR: Record<string, string> = { bank_stats: "إحصاء البنك", create_exam: "إنشاء امتحان", list_exams: "قائمة الامتحانات", attendance_summary: "ملخص الحضور", student_progress: "نبذة طالب", review_exam: "مراجعة امتحان", generate_drafts: "تأليف مسودات", search_knowledge: "بحث المعرفة", book_guide: "دليل الكتب", solve_question: "حل مسألة", solve_exam: "حل امتحان", app_help: "مساعدة التطبيق" };

export default function AgentPage() {
  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // إدخال صوتي: Web Speech API (مجاني، بلا مفاتيح — يعمل على Chrome/Edge)
  function toggleListen() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("المتصفح لا يدعم الإدخال الصوتي — استخدم Chrome."); return; }
    if (listening) return;
    try {
      const rec = new SR();
      rec.lang = "ar-EG";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setListening(true);
      rec.onresult = (e: any) => {
        const t = e.results?.[0]?.[0]?.transcript ?? "";
        if (t) setInput((p) => (p ? p + " " : "") + t);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.start();
    } catch { setListening(false); }
  }

  // قراءة صوتية للرد: speechSynthesis (مجاني، بلا مفاتيح)
  function speak(key: string, text: string) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) { setErr("المتصفح لا يدعم القراءة الصوتية."); return; }
      if (speaking === key) { synth.cancel(); setSpeaking(null); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 600));
      u.lang = "ar-SA";
      u.onend = () => setSpeaking(null);
      setSpeaking(key);
      synth.speak(u);
    } catch {}
  }

  async function loadThreads() {
    try {
      const r = await fetch("/api/agent/threads", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setThreads(j.threads ?? []);
    } catch {}
  }
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(e?: React.FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    setInput(""); setErr(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", text }]);
    // بطاقة مساعدة تُملأ تدريجياً مع أحداث البث
    const idxRef = { i: -1 };
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, message: text }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => null);
        setErr(j?.message ?? "فشل: " + (j?.error ?? ""));
        setBusy(false);
        return;
      }
      setMsgs((p) => { idxRef.i = p.length; return [...p, { role: "assistant", text: "", steps: [] }]; });
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const patch = (fn: (m: Msg) => Msg) =>
        setMsgs((p) => p.map((m, i) => (i === idxRef.i ? fn(m) : m)));
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const j = JSON.parse(line.slice(5)) as any;
          if (j.type === "thread" && j.thread_id && !threadId) {
            setThreadId(j.thread_id); loadThreads();
          } else if (j.type === "token" && typeof j.text === "string") {
            patch((m) => ({ ...m, text: m.text + j.text }));
          } else if (j.type === "step") {
            patch((m) => ({ ...m, steps: [...(m.steps ?? []), { tool: j.tool, ok: j.ok }] }));
          } else if (j.type === "done") {
            if (j.thread_id && !threadId) { setThreadId(j.thread_id); loadThreads(); }
            patch(() => ({ role: "assistant", text: j.text ?? "", steps: j.steps ?? [], suggest: j.suggest ?? [] }));
          }
        }
      }
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
              <div className="whitespace-pre-wrap">
                {m.role === "assistant" && m.text ? (
                  <button onClick={() => speak(`${i}`, m.text)} title="استماع للرد"
                    className="float-left ml-2 rounded-full bg-white px-2 py-0.5 text-xs shadow-sm transition hover:scale-110">
                    {speaking === `${i}` ? "⏹️" : "🔊"}
                  </button>
                ) : null}
                {m.text || (m.role === "assistant" ? "…" : "")}
              </div>
              {(m.steps ?? []).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(m.steps ?? []).map((s, k) => (
                    <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.ok ? "bg-success/15 text-success" : "bg-danger/10 text-danger"}`}>
                      🔧 {TOOL_AR[s.tool] ?? s.tool}
                    </span>
                  ))}
                </div>
              )}
              {(m.suggest ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(m.suggest ?? []).map((s, k) => (
                    <button key={k} onClick={() => send(undefined, s)} disabled={busy}
                      className="rounded-full border border-primary/30 px-3 py-1 text-[11px] font-bold text-primary transition hover:bg-primary-light disabled:opacity-50">
                      {s}
                    </button>
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
          <button type="button" onClick={toggleListen} title="إدخال صوتي"
            className={`shrink-0 rounded-xl border-2 px-3 text-lg transition ${listening ? "animate-pulse border-danger bg-danger/10" : "border-slate-200 hover:border-primary"}`}>
            {listening ? "🔴" : "🎤"}
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب طلبك... أو تحدث 🎤"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <button className="btn-primary" disabled={busy || !input.trim()}>{busy ? "..." : "إرسال"}</button>
        </form>
      </div>
    </div>
  );
}
