"use client";

import { useState } from "react";

type Sug = { qid: string; body: string; subject: string; code: string; lesson: string; unit: string; score: number; shared: string[] };

/** ربط أسئلتك بالدروس تلقائياً — اقتراحات تُراجع ثم تُطبق */
export default function LessonLinker({ onLinked }: { onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [sugs, setSugs] = useState<Sug[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [unlinked, setUnlinked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function suggest() {
    setBusy(true); setMsg(""); setOpen(true);
    try {
      const r = await fetch("/api/questions/auto-link", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest" }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setSugs(j.suggestions);
        setPicked(new Set((j.suggestions as Sug[]).map((s) => s.qid)));
        setUnlinked(j.unlinked ?? 0);
        if (!j.suggestions.length) setMsg(j.unlinked ? "لا توجد تطابقات واثقة — اربط الباقي يدوياً." : "كل أسئلتك مربوطة بالدروس ✅");
      } else setMsg("فشل الاقتراح.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function apply() {
    if (!sugs || !picked.size) return;
    setBusy(true); setMsg("");
    try {
      const links = sugs.filter((s) => picked.has(s.qid)).map((s) => ({ qid: s.qid, code: s.code }));
      const r = await fetch("/api/questions/auto-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", links }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMsg(`تم ربط ${j.updated} سؤالاً بالدروس ✅`);
        setSugs(null); setPicked(new Set());
        onLinked();
      } else setMsg("فشل التطبيق.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-small font-bold">ربط الدروس 🔗</span>
          <span className="mx-2 text-xs text-slate-500">أسئلة بلا ربط لا تدخل التوليد المنهجي</span>
        </div>
        <button onClick={suggest} disabled={busy} className="btn-secondary !px-4 !py-1.5 text-xs disabled:opacity-50">
          {busy ? "جاري..." : "اقتراح ربط تلقائي"}
        </button>
      </div>
      {open && (
        <div>
          {msg && <div className="mb-2 text-xs font-bold text-primary">{msg}</div>}
          {sugs !== null && sugs.length > 0 && (
            <>
              <p className="mb-2 text-xs text-slate-500">{unlinked} سؤالاً بلا ربط — {sugs.length} اقتراحاً واثقاً (راجع وطبّق المحدد):</p>
              <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
                {sugs.map((s) => (
                  <li key={s.qid}>
                    <label className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${picked.has(s.qid) ? "border-primary bg-primary-light/40" : "border-slate-200"}`}>
                      <input type="checkbox" checked={picked.has(s.qid)} onChange={() => setPicked((p) => {
                        const n = new Set(p);
                        if (n.has(s.qid)) n.delete(s.qid); else n.add(s.qid);
                        return n;
                      })} className="mt-1" />
                      <span>
                        <span className="block font-bold">{s.body}…</span>
                        <span className="text-slate-500">→ {s.lesson} <span className="text-slate-400">({s.subject} · تطابق {s.score}: {s.shared.join("، ")})</span></span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button onClick={apply} disabled={busy || !picked.size} className="btn-primary mt-3 w-full !py-2 text-small disabled:opacity-50">
                {busy ? "جاري التطبيق..." : `تطبيق الربط (${picked.size})`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
