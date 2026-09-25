"use client";

import { useState } from "react";

type Flag = { student_id: string; student: string; score: number; level: string; evidence: string[] };

/** مؤشرات الاشتباه الإحصائية — عرض محايد بلا اتهام */
export default function SuspicionPanel({ examId, attempts }: { examId: string; attempts: number }) {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [timing, setTiming] = useState<{ n: number; min: number; p25: number | null; median: number | null; max: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/exams/${examId}/suspicion`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setFlags(j.flags); if (j.timing) setTiming(j.timing); }
      else setErr("تعذر التحليل.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  if (attempts < 2) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <button onClick={() => { setOpen((v) => !v); if (!open && flags === null) load(); }}
        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
        {open ? "إخفاء المؤشرات" : "مؤشرات الاشتباه 🕵️"}
      </button>
      {open && (
        <div className="mt-3">
          {busy && <div className="text-xs text-slate-400">جاري التحليل...</div>}
          {err && <div className="text-xs font-bold text-danger">{err}</div>}
          {timing && (
            <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              ⏱️ مدد الحل ({timing.n} محاولات): أسرع {timing.min} د · الوسيط {timing.median ?? "—"} د · الأبطأ {timing.max} د
            </div>
          )}
          {flags !== null && flags.length === 0 && (
            <div className="text-xs font-bold text-success">لا توجد أنماط غير معتادة — كل المحاولات طبيعية ✅</div>
          )}
          {flags !== null && flags.length > 0 && (
            <ul className="space-y-2">
              {flags.map((f) => (
                <li key={f.student_id} className={`rounded-xl border p-3 text-xs ${f.level === "high" ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{f.student}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${f.level === "high" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                      {f.level === "high" ? "اشتباه مرتفع" : "يحتاج مراجعة"} · {f.score}
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-slate-600">
                    {f.evidence.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </li>
              ))}
              <li className="text-[11px] text-slate-400">مؤشرات إحصائية تستحق المراجعة — لا تثبت الغش وحدها.</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
