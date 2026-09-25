"use client";

import { useState } from "react";

type CodeRow = {
  id: string; student_id: string | null; student: string; code_hint: string;
  status: string; device_fp: string | null; ip: string | null;
  issued_at: string; started_at: string | null; expires_at: string | null; submitted_at: string | null;
};

const STATUS: Record<string, [string, string]> = {
  issued: ["مُصدر ⏳", "bg-slate-100 text-slate-600"],
  started: ["نشط الآن 🟢", "bg-success/10 text-success"],
  submitted: ["مُسلَّم ✅", "bg-primary-light text-primary"],
  expired: ["منتهي ⌛", "bg-warning/10 text-warning"],
  revoked: ["ملغي ⛔", "bg-danger/10 text-danger"],
};

export default function ExamCodesManager({ examId, required, onToggleRequire }: {
  examId: string; required: boolean; onToggleRequire: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [fresh, setFresh] = useState<{ student: string; code: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const r = await fetch(`/api/exams/${examId}/codes`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setCodes(j.codes); if (typeof j.require_code === "boolean") onToggleRequire(j.require_code); }
      else setErr("تعذر تحميل الأكواد.");
    } catch { setErr("تعذر الاتصال."); }
  }

  async function generate() {
    if (!confirm("توليد أكواد لكل طلاب السنتر؟ (من لديه كود نشط يُتخطى)")) return;
    setBusy(true); setErr(""); setFresh(null);
    try {
      const r = await fetch(`/api/exams/${examId}/codes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setFresh(j.codes); load(); }
      else setErr(j?.error === "all_have_codes" ? "كل الطلاب لديهم أكواد نشطة بالفعل." : "فشل التوليد.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function revoke(codeId: string) {
    if (!confirm("سحب هذا الكود؟ لن يتمكن صاحبه من الدخول به.")) return;
    try {
      const r = await fetch(`/api/exams/${examId}/codes`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code_id: codeId }),
      });
      if (r.ok) load();
      else setErr("فشل السحب.");
    } catch { setErr("تعذر الاتصال."); }
  }

  function copyAll() {
    if (!fresh?.length) return;
    const txt = fresh.map((f) => `${f.student}: ${f.code}`).join("\n");
    navigator.clipboard?.writeText(txt).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={required} onChange={(e) => onToggleRequire(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          دخول بكود لكل طالب 🔐 {required && <span className="text-success">(مفعّل)</span>}
        </label>
        <button onClick={() => { setOpen((v) => !v); if (!open && codes === null) load(); }}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
          {open ? "إخفاء الأكواد" : "إدارة الأكواد"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {err && <div className="text-xs font-bold text-danger">{err}</div>}
          <button onClick={generate} disabled={busy} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {busy ? "جاري التوليد..." : "توليد أكواد للطلاب ⚙️"}
          </button>

          {fresh && fresh.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-amber-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-warning">⚠️ الأكواد الكاملة تظهر مرة واحدة — انسخها ووزعها الآن</span>
                <button onClick={copyAll} className="rounded-lg bg-white px-3 py-1 text-xs font-bold shadow-sm">نسخ الكل 📋</button>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs" dir="ltr">
                {fresh.map((f, i) => <li key={i} className="flex justify-between rounded bg-white px-3 py-1"><span>{f.student}</span><b className="tracking-widest">{f.code}</b></li>)}
              </ul>
            </div>
          )}

          {codes === null ? (
            <div className="text-xs text-slate-400">جاري التحميل...</div>
          ) : codes.length === 0 ? (
            <div className="text-xs text-slate-500">لا توجد أكواد بعد — ولّد أكواداً من الزر بالأعلى.</div>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto text-xs">
              {codes.map((c) => {
                const [label, tone] = STATUS[c.status] ?? [c.status, "bg-slate-100"];
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{c.student}</span>
                      <span className="font-mono text-slate-400" dir="ltr">{c.code_hint}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
                      {(c.status === "started" || c.status === "submitted") && (c.device_fp || c.ip) && (
                        <span className="font-mono text-[10px] text-slate-400" dir="ltr" title="بصمة الجهاز وعنوان الشبكة — لمراجعة الجلسات">
                          {c.device_fp ?? ""} {c.ip ? `· ${c.ip}` : ""}
                        </span>
                      )}
                    </div>
                    {(c.status === "issued" || c.status === "started") && (
                      <button onClick={() => revoke(c.id)} className="font-bold text-danger">سحب</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
