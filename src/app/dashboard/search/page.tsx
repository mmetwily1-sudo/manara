"use client";

import { useEffect, useState } from "react";

type Hit = { scope: string; id: string; title: string; snippet: string };

const SCOPE_LABEL: Record<string, string> = { notes: "مذكرات 📝", library: "مكتبة 📚", questions: "بنك الأسئلة ❓", knowledge: "معرفة 🧠" };
const SCOPE_LINK: Record<string, (id: string) => string> = {
  notes: () => "/dashboard/notes",
  library: () => "/dashboard/store",
  questions: () => "/dashboard/questions",
  knowledge: () => "/dashboard/questions",
};

/** بحث موحد في المحتوى: مذكرات + مكتبة + بنك + معرفة */
export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [scope, setScope] = useState("all");
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<Hit[]>([]);
  const [listening, setListening] = useState(false);

  async function run(e?: React.FormEvent, query?: string) {
    e?.preventDefault();
    const term = (query ?? q).trim();
    if (term.length < 2) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setHits(j.hits ?? []); setSuggest([]); }
    } catch {}
    finally { setBusy(false); }
  }

  const shown = scope === "all" ? hits : hits.filter((h) => h.scope === scope);
  const scopes = Array.from(new Set(hits.map((h) => h.scope)));

  // اقتراحات فورية أثناء الكتابة (debounce)
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setSuggest([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) setSuggest((j.hits ?? []).slice(0, 5));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  // بحث صوتي (Web Speech API — يعمل على كروم/أندرويد)
  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("البحث الصوتي غير مدعوم على هذا المتصفح — جرّب كروم."); return; }
    try {
      const rec = new SR();
      rec.lang = "ar-EG";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setListening(true);
      rec.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript ?? "";
        if (text) { setQ(text); }
        setListening(false);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
    } catch { setListening(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">البحث الموحد 🔍</h1>
        <p className="mt-1 text-small text-slate-500">مذكراتك + المكتبة + البنك + المعرفة</p>
      </header>
      <form onSubmit={run} className="card flex gap-2 p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن درس، مذكرة، سؤال..."
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5" />
        <button type="button" onClick={voice} title="بحث صوتي 🎤" aria-label="بحث صوتي"
          className={`shrink-0 rounded-xl border px-3 text-lg transition ${listening ? "animate-pulse border-danger bg-danger/10" : "border-slate-200 bg-white"}`}>
          🎤
        </button>
        <button disabled={busy} className="btn-primary shrink-0 disabled:opacity-50">{busy ? "..." : "بحث"}</button>
      </form>
      {suggest.length > 0 && (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {suggest.map((h, i) => (
            <li key={`${h.scope}-${h.id}-${i}`}>
              <button
                onClick={() => { setQ(h.title); run(undefined, h.title); }}
                className="block w-full px-4 py-2.5 text-right text-small transition hover:bg-slate-50"
              >
                <span className="font-bold" dir="auto">{h.title}</span>
                <span className="mr-2 text-xs text-slate-400">{SCOPE_LABEL[h.scope] ?? h.scope}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {scopes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setScope("all")} className={`rounded-full px-4 py-1.5 text-small font-bold ${scope === "all" ? "bg-primary text-white" : "bg-slate-100"}`}>الكل</button>
          {scopes.map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 text-small font-bold ${scope === s ? "bg-primary text-white" : "bg-slate-100"}`}>
              {SCOPE_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((h, i) => (
            <li key={`${h.scope}-${h.id}-${i}`} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold" dir="auto">{h.title}</span>
                <a href={SCOPE_LINK[h.scope]?.(h.id) ?? "#"} className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-[11px] font-bold text-primary">
                  {SCOPE_LABEL[h.scope] ?? h.scope}
                </a>
              </div>
              {h.snippet && <div dir="auto" className="mt-1 text-small text-slate-500">{h.snippet}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
