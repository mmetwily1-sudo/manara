"use client";

import { useEffect, useState } from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Sheet = { id: string; title: string; num_questions: number; num_choices: number; results: number };
type Result = { id: string; student_name: string | null; score: number; total: number; needs_review: boolean; answers: (string | null)[]; created_at: string };

export default function OmrPage() {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [form, setForm] = useState({ title: "", num_questions: "20", num_choices: "4", key: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [gradeName, setGradeName] = useState("");
  const [gradeFiles, setGradeFiles] = useState<FileList | null>(null);
  const [gradeBusy, setGradeBusy] = useState(false);
  const [printSheet, setPrintSheet] = useState<any | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/omr", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setSheets(j.sheets ?? []);
      else if (j?.error === "not_ready") setErr(j.message ?? "");
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setOkMsg("");
    try {
      const nq = Number(form.num_questions) || 0;
      const key = form.key.replace(/\s+/g, "").toUpperCase().split("").slice(0, nq);
      const r = await fetch("/api/omr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, num_questions: nq, num_choices: Number(form.num_choices) || 4, answer_key: key }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg("تم إنشاء ورقة البابل شيت ✅ — اطبعها ووزعها.");
        setForm({ title: "", num_questions: "20", num_choices: "4", key: "" });
        load();
      } else setErr(j?.message ?? "فشل الإنشاء: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  async function openSheet(id: string) {
    if (open?.id === id) { setOpen(null); return; }
    try {
      const r = await fetch(`/api/omr/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setOpen(j.sheet); setResults(j.results ?? []); }
    } catch {}
  }

  async function onGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!open || !gradeFiles?.length) { setErr("اختر صورة الورقة."); return; }
    setGradeBusy(true); setErr(""); setOkMsg("");
    try {
      const fd = new FormData();
      fd.set("photo", gradeFiles[0]);
      if (gradeName.trim()) fd.set("student_name", gradeName.trim());
      const r = await fetch(`/api/omr/${open.id}/grade`, { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg(`النتيجة: ${j.score}/${j.total}${j.needs_review ? ` — ${j.unsure} أسئلة غامضة تحتاج مراجعتك.` : " ✅"}`);
        setGradeFiles(null); setGradeName("");
        openSheet(open.id); load();
      } else setErr(j?.message ?? "فشل التصحيح: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setGradeBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("حذف الورقة وكل نتائجها؟")) return;
    await fetch(`/api/omr/${id}`, { method: "DELETE" });
    if (open?.id === id) setOpen(null);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">بابل شيت OMR ⭕</h1>
        <p className="mt-1 text-small text-slate-500">أنشئ ورقة + نموذج إجابة ← اطبع ← صوّر الورقة المظللة ← تصحيح فوري.</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {okMsg && <div className="card border-success/30 bg-success/5 p-4 text-small font-bold text-success">{okMsg}</div>}

      <form onSubmit={onCreate} className="card grid gap-3 p-5 sm:grid-cols-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
          placeholder="اسم الورقة (مثال: اختبار فيزياء — بابل شيت)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
        <div className="flex gap-2">
          <input value={form.num_questions} onChange={(e) => setForm({ ...form, num_questions: e.target.value })} inputMode="numeric"
            placeholder="عدد الأسئلة" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <select value={form.num_choices} onChange={(e) => setForm({ ...form, num_choices: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} اختيارات</option>)}
          </select>
        </div>
        <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required dir="ltr"
          placeholder="نموذج الإجابة حروفاً متصلة: ABBDC..." style={{ textAlign: "right" }}
          className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري..." : "إنشاء الورقة"}</button>
      </form>

      {sheets !== null && sheets.length > 0 && (
        <ul className="space-y-3">
          {sheets.map((s) => (
            <li key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-small font-bold">{s.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{s.num_questions} سؤال · {s.num_choices} اختيارات · {s.results} نتيجة</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPrintSheet(s)} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold">🖨️ طباعة الورقة</button>
                  <button onClick={() => openSheet(s.id)} className="rounded-lg bg-primary-light px-3 py-1 text-xs font-bold text-primary">
                    {open?.id === s.id ? "إخفاء" : "تصحيح ونتائج"}
                  </button>
                  <button onClick={() => onDelete(s.id)} className="rounded-lg px-3 py-1 text-xs font-bold text-danger hover:bg-danger/10">حذف</button>
                </div>
              </div>
              {open?.id === s.id && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <form onSubmit={onGrade} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <input value={gradeName} onChange={(e) => setGradeName(e.target.value)} placeholder="اسم الطالب (اختياري)"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small outline-none" />
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 hover:border-primary hover:text-primary">
                      {gradeFiles?.length ? "📎 صورة مختارة" : "صوّر الورقة المظللة"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setGradeFiles(e.target.files)} />
                    </label>
                    <button className="btn-primary !py-2 text-small" disabled={gradeBusy}>{gradeBusy ? "جاري التصحيح..." : "صحّح ✅"}</button>
                  </form>
                  {results.length === 0 ? <p className="text-xs text-slate-400">لا نتائج بعد.</p> : (
                    <ul className="space-y-1.5">
                      {results.map((r) => (
                        <li key={r.id} className={`flex items-center justify-between rounded-xl px-4 py-2 text-small ${r.needs_review ? "bg-warning/10" : "bg-slate-50"}`}>
                          <span className="font-bold">{r.student_name ?? "بدون اسم"}{r.needs_review && " ⚠️ راجع"}</span>
                          <span>{r.score}/{r.total} · {new Date(r.created_at).toLocaleDateString("ar-EG")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {printSheet && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="btn-primary">طباعة 🖨️</button>
              <button onClick={() => setPrintSheet(null)} className="btn-secondary">إغلاق</button>
            </div>
            <h2 className="text-center text-xl font-extrabold">{printSheet.title}</h2>
            <p className="mt-1 text-center text-small">الاسم: ــــــــــــــــــــــ · ظلل دائرة واحدة لكل سؤال</p>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5" dir="ltr">
              {Array.from({ length: printSheet.num_questions }, (_, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-slate-200 py-1">
                  <span className="w-8 font-bold">{i + 1}</span>
                  {LETTERS.slice(0, printSheet.num_choices).map((L) => (
                    <span key={L} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-400 text-xs font-bold">{L}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
