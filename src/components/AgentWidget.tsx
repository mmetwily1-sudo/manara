"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string; steps?: { tool: string; ok: boolean }[]; suggest?: string[] };

const TOOL_AR: Record<string, string> = {
  bank_stats: "إحصاء البنك", create_exam: "إنشاء امتحان", list_exams: "الامتحانات",
  attendance_summary: "الحضور", student_progress: "طالب", review_exam: "مراجعة",
  generate_drafts: "تأليف", search_knowledge: "المعرفة", book_guide: "الكتب",
  solve_question: "حل مسألة", solve_exam: "حل امتحان", app_help: "مساعدة",
  curriculum_outline: "مخطط المنهج",
};

/**
 * ودجت مساعد منارة العائم — يظهر في كل صفحات الداشبورد (يمين-أسفل، بعيداً عن زر واتساب).
 * نفس محرك الدردشة: بث حي + أدوات + صوت + اقتراحات.
 */
export function AgentWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  async function send(e?: React.FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    setInput(""); setBusy(true);
    setMsgs((p) => [...p, { role: "user", text }]);
    const idxRef = { i: -1 };
    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: null, message: text }),
      });
      if (!r.ok || !r.body) { setMsgs((p) => [...p, { role: "assistant", text: "تعذر الاتصال — حاول مجدداً." }]); setBusy(false); return; }
      setMsgs((p) => { idxRef.i = p.length; return [...p, { role: "assistant", text: "", steps: [] }]; });
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const patch = (fn: (m: Msg) => Msg) => setMsgs((p) => p.map((m, i) => (i === idxRef.i ? fn(m) : m)));
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
          if (j.type === "token" && typeof j.text === "string") {
            patch((m) => ({ ...m, text: m.text + j.text }));
          } else if (j.type === "step") {
            patch((m) => ({ ...m, steps: [...(m.steps ?? []), { tool: j.tool, ok: j.ok }] }));
          } else if (j.type === "done") {
            patch(() => ({ role: "assistant", text: j.text ?? "", steps: j.steps ?? [], suggest: j.suggest ?? [] }));
          }
        }
      }
    } catch {
      setMsgs((p) => [...p, { role: "assistant", text: "تعذر الاتصال بالخادم." }]);
    } finally { setBusy(false); }
  }

  function toggleListen() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || listening) return;
    try {
      const rec = new SR();
      rec.lang = "ar-EG";
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

  function speak(key: string, text: string) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (speaking === key) { synth.cancel(); setSpeaking(null); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 600));
      u.lang = "ar-SA";
      u.onend = () => setSpeaking(null);
      setSpeaking(key);
      synth.speak(u);
    } catch {}
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="مساعد منارة"
          className="fixed bottom-[4.75rem] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg transition hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6">
          🤖
        </button>
      )}
      {open && (
        <div className="fixed bottom-[4.75rem] right-2 left-2 z-50 flex h-[min(560px,80vh)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:left-auto sm:w-[390px] lg:bottom-4 lg:right-4">
          <div className="flex items-center justify-between bg-primary px-4 py-2.5 text-white">
            <span className="text-small font-bold">مساعد منارة 🤖</span>
            <button onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-full px-2 py-0.5 text-lg transition hover:bg-white/20">−</button>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <div className="space-y-2 text-center text-xs text-slate-500">
                <p className="text-3xl">🤖</p>
                <p>اسألني عن بنكك، امتحاناتك، الحضور، الواجبات، الوزارة والكتب.</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {["عندنا إيه في البنك؟", "ملخص الحضور", "أفضل كتاب فيزياء؟"].map((s) => (
                    <button key={s} onClick={() => send(undefined, s)} disabled={busy}
                      className="rounded-full border border-primary/30 px-3 py-1 text-[11px] font-bold text-primary disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[90%] rounded-2xl px-3 py-2 text-small leading-relaxed ${m.role === "user" ? "mr-auto bg-primary text-white" : "bg-slate-100"}`}>
                <div className="whitespace-pre-wrap">
                  {m.role === "assistant" && m.text ? (
                    <button onClick={() => speak(`${i}`, m.text)} className="float-left ml-1 rounded-full bg-white px-1.5 text-[11px] shadow-sm">
                      {speaking === `${i}` ? "⏹️" : "🔊"}
                    </button>
                  ) : null}
                  {m.text || (m.role === "assistant" ? "…" : "")}
                </div>
                {(m.steps ?? []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(m.steps ?? []).map((s, k) => (
                      <span key={k} className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        🔧 {TOOL_AR[s.tool] ?? s.tool}
                      </span>
                    ))}
                  </div>
                )}
                {(m.suggest ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(m.suggest ?? []).map((s, k) => (
                      <button key={k} onClick={() => send(undefined, s)} disabled={busy}
                        className="rounded-full border border-primary/30 bg-white px-2 py-0.5 text-[10px] font-bold text-primary disabled:opacity-50">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && msgs[msgs.length - 1]?.role === "user" && (
              <div className="w-fit rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">يفكر…</div>
            )}
            <div ref={bottom} />
          </div>
          <form onSubmit={send} className="flex gap-1.5 border-t border-slate-100 p-2">
            <button type="button" onClick={toggleListen} title="إدخال صوتي"
              className={`shrink-0 rounded-xl border-2 px-2.5 transition ${listening ? "animate-pulse border-danger bg-danger/10" : "border-slate-200"}`}>
              {listening ? "🔴" : "🎤"}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="اسأل المساعد..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary" />
            <button className="btn-primary shrink-0 !px-4 !py-2 text-small" disabled={busy || !input.trim()}>
              {busy ? "..." : "➤"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
