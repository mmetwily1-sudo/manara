"use client";

import { useState } from "react";

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

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setHits(j.hits ?? []);
    } catch {}
    finally { setBusy(false); }
  }

  const shown = scope === "all" ? hits : hits.filter((h) => h.scope === scope);
  const scopes = Array.from(new Set(hits.map((h) => h.scope)));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">البحث الموحد 🔍</h1>
        <p className="mt-1 text-small text-slate-500">مذكراتك + المكتبة + البنك + المعرفة</p>
      </header>
      <form onSubmit={run} className="card flex gap-2 p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن درس، مذكرة، سؤال..." minLength={2}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5" />
        <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "..." : "بحث"}</button>
      </form>
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
