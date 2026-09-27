"use client";

import { useEffect, useState } from "react";
import { waTo } from "@/lib/wa";

type Digest = {
  id: string; student: string; phone: string | null; period: string;
  payload: { kind?: string; present: number; absent: number; due: number; exams: { title: string; score: number; total: number }[] };
  wa_text: string; created_at: string;
};

/** تقارير أولياء الأمور — توليد + مشاركة واتساب بضغطة + وصول push تلقائي */
export default function DigestsPage() {
  const [digests, setDigests] = useState<Digest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/digests");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDigests(j.digests);
      else setErr("تعذر التحميل.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function generate(mode: "weekly" | "monthly") {
    if (!confirm(mode === "monthly" ? "توليد الملخص الشهري لكل الطلاب؟ (يُرسل push للمشتركين تلقائياً)" : "توليد تقارير الأسبوع الحالي لكل الطلاب؟ (يُرسل push للمشتركين تلقائياً)")) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/digests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) load();
      else setErr("فشل التوليد.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  function copy(id: string, txt: string) {
    navigator.clipboard?.writeText(txt).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">تقارير أولياء الأمور 📊</h1>
          <p className="mt-1 text-small text-slate-500">تقرير أسبوعي لكل طالب: حضور ودرجات ومستحق — push تلقائي + مشاركة واتساب</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generate("weekly")} disabled={busy} className="btn-primary text-small disabled:opacity-50">
            {busy ? "جاري التوليد..." : "توليد تقارير الأسبوع"}
          </button>
          <button onClick={() => generate("monthly")} disabled={busy} className="btn-secondary text-small disabled:opacity-50">
            الملخص الشهري 📅
          </button>
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {digests === null ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : digests.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا توجد تقارير بعد — ولّد تقارير الأسبوع بالزر بالأعلى.</div>
      ) : (
        <ul className="space-y-3">
          {digests.map((d) => {
            const link = waTo(d.phone, d.wa_text);
            return (
              <li key={d.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">{d.student}</span>
                    <span className="mx-2 text-xs text-slate-400">{d.payload.kind === "monthly" ? `شهري ${d.period}` : `أسبوع ${d.period}`}</span>
                  </div>
                  <div className="flex gap-2">
                    {link && <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white">إرسال واتساب 💬</a>}
                    <button onClick={() => copy(d.id, d.wa_text)} className="btn-secondary !px-4 !py-1.5 text-xs">
                      {copied === d.id ? "✓ تم" : "نسخ التقرير"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-success/10 px-3 py-1 font-bold text-success">حضور {d.payload.present}</span>
                  <span className="rounded-full bg-danger/10 px-3 py-1 font-bold text-danger">غياب {d.payload.absent}</span>
                  {d.payload.due > 0 && <span className="rounded-full bg-warning/10 px-3 py-1 font-bold text-warning">مستحق {d.payload.due} ج</span>}
                  {(d.payload.exams ?? []).map((e, i) => (
                    <span key={i} className="rounded-full bg-primary-light px-3 py-1 font-bold text-primary">{e.title}: {e.score}{e.total ? `/${e.total}` : ""}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
