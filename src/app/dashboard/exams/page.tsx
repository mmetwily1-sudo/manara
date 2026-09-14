"use client";

import { useEffect, useState } from "react";

type ExamRow = {
  id: string; title: string; duration_minutes: number; total_marks: number;
  is_published: boolean; questions_count: number; attempts_count: number;
};
type BankStats = { total: number; byLevel: Record<string, number> };

const FETCH_TIMEOUT_MS = 55000;

async function apiFetch(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const j = await r.json().catch(() => null);
    return { r, j };
  } finally {
    clearTimeout(t);
  }
}

const LEVEL_LABELS: Record<string, string> = { "1": "سهل", "2": "متوسط", "3": "صعب" };

export default function ExamsListPage() {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [stats, setStats] = useState<BankStats | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", easy: 2, mid: 2, hard: 1, duration: 30 });

  async function loadAll() {
    try {
      const [er, sr] = await Promise.all([apiFetch("/api/exams"), apiFetch("/api/questions/stats")]);
      if (er.r.ok && er.j?.ok) setExams(er.j.exams);
      else setNotice({ kind: "err", text: er.j?.error === "unauth" ? "سجّل دخولك أولاً." : "تعذر تحميل الامتحانات." });
      if (sr.r.ok && sr.j?.ok) setStats({ total: sr.j.total, byLevel: sr.j.byLevel });
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم — تحقق من الإنترنت وحاول مجدداً." });
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setNotice({ kind: "err", text: "اكتب عنواناً للامتحان أولاً." });
      return;
    }
    const total = form.easy + form.mid + form.hard;
    if (total < 1) {
      setNotice({ kind: "err", text: "اطلب سؤالاً واحداً على الأقل." });
      return;
    }
    setGenerating(true);
    setNotice(null);
    try {
      const { r, j } = await apiFetch("/api/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          duration: form.duration,
          distribution: { 1: form.easy, 2: form.mid, 3: form.hard },
        }),
      });
      if (r.ok && j?.ok) {
        const parts = Object.entries(j.pickedCount ?? {})
          .filter(([, n]) => Number(n) > 0)
          .map(([d, n]) => `${n} ${LEVEL_LABELS[d] ?? ""}`)
          .join(" + ");
        setNotice({
          kind: j.shortfall ? "warn" : "ok",
          text: j.shortfall
            ? `تم إنشاء الامتحان بـ ${j.picked} أسئلة فقط (${parts}) — بنك الأسئلة يحتاج أسئلة أكثر.`
            : `تم إنشاء الامتحان بنجاح (${parts || j.picked + " أسئلة"}).`,
        });
        setForm((f) => ({ ...f, title: "" }));
        loadAll();
      } else {
        setNotice({ kind: "err", text: j?.error === "unauth" ? "انتهت جلستك — سجّل دخولك مجدداً." : `فشل التوليد: ${j?.error ?? "خطأ غير معروف"}` });
      }
    } catch {
      setNotice({ kind: "err", text: "انتهت مهلة الاتصال — تحقق من الإنترنت وحاول مجدداً. لو تكرر، قلل عدد الأسئلة." });
    } finally {
      setGenerating(false);
    }
  }

  async function onDelete(id: string, title: string, attempts: number) {
    if (!confirm(`حذف "${title}" نهائياً؟${attempts ? `\nسيُحذف معه ${attempts} محاولة وشهاداتها.` : ""}`)) return;
    setDeletingId(id);
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}`, { method: "DELETE" });
      if (r.ok && j?.ok) {
        setNotice({ kind: "ok", text: "تم حذف الامتحان." });
        setExams((prev) => (prev ?? []).filter((e) => e.id !== id));
      } else {
        setNotice({ kind: "err", text: `فشل الحذف: ${j?.error ?? "خطأ غير معروف"}` });
      }
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." });
    } finally {
      setDeletingId(null);
    }
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/exam/${id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    }).catch(() => {
      setNotice({ kind: "err", text: "تعذر النسخ — انسخ الرابط يدوياً: " + url });
    });
  }

  const bankEmpty = stats !== null && stats.total === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">الامتحانات</h1>
        <p className="mt-1 text-small text-slate-500">ولّد امتحاناً من بنك أسئلتك بضغطة واحدة، وشاركه مع طلابك برابط</p>
      </header>

      {notice && (
        <div className={`card p-4 text-small font-bold ${
          notice.kind === "ok" ? "border-success/30 bg-success/5 text-success"
          : notice.kind === "warn" ? "border-warning/30 bg-warning/5 text-warning"
          : "border-danger/20 bg-danger/5 text-danger"}`}>
          {notice.text}
        </div>
      )}

      {/* حالة بنك الأسئلة */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-small">
        <span className="font-bold">بنك الأسئلة:</span>
        {stats === null ? (
          <span className="text-slate-400">جاري الحساب...</span>
        ) : bankEmpty ? (
          <span className="font-bold text-danger">
            فارغ — <a href="/dashboard/questions" className="underline">أضف أسئلة أولاً من بنك الأسئلة</a>
          </span>
        ) : (
          <>
            <span>🟢 سهل: <b>{stats.byLevel["1"] ?? 0}</b></span>
            <span>🟡 متوسط: <b>{stats.byLevel["2"] ?? 0}</b></span>
            <span>🔴 صعب: <b>{stats.byLevel["3"] ?? 0}</b></span>
            <span className="text-slate-400">(الإجمالي: {stats.total})</span>
          </>
        )}
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="font-bold">توليد امتحان جديد</h2>
        <form onSubmit={onGenerate} className="grid gap-4">
          <div>
            <label htmlFor="ex-title" className="mb-1 block text-xs font-bold text-slate-600">عنوان الامتحان</label>
            <input id="ex-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: اختبار الوحدة الأولى — فيزياء"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["easy", "عدد الأسئلة السهلة", "bg-success/10 text-success"],
              ["mid", "عدد الأسئلة المتوسطة", "bg-warning/10 text-warning"],
              ["hard", "عدد الأسئلة الصعبة", "bg-danger/10 text-danger"],
              ["duration", "المدة (دقيقة)", "bg-slate-100 text-slate-600"],
            ] as const).map(([key, label, badge]) => (
              <div key={key}>
                <label htmlFor={`ex-${key}`} className="mb-1 block text-xs font-bold text-slate-600">{label}</label>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="إنقاص"
                    onClick={() => setForm((f) => ({ ...f, [key]: Math.max(key === "duration" ? 5 : 0, Number(f[key]) - 1) }))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-500 transition hover:border-primary hover:text-primary">−</button>
                  <input id={`ex-${key}`} type="number" min={key === "duration" ? 5 : 0} max={key === "duration" ? 180 : 50}
                    value={form[key]} onChange={(e) => setForm({ ...form, [key]: Math.max(0, Number(e.target.value) || 0) })}
                    className={`w-full rounded-lg border px-2 py-2 text-center font-bold outline-none ${badge}`} />
                  <button type="button" aria-label="زيادة"
                    onClick={() => setForm((f) => ({ ...f, [key]: Math.min(key === "duration" ? 180 : 50, Number(f[key]) + 1) }))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-500 transition hover:border-primary hover:text-primary">+</button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary w-full sm:w-auto sm:px-10" disabled={generating || bankEmpty}>
            {generating ? "جاري التوليد... (قد يستغرق ثواني)" : "توليد الامتحان الآن"}
          </button>
        </form>
      </div>

      {exams === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الامتحانات...</div>
      ) : exams.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">لا توجد امتحانات بعد — ولّد أول امتحان من الأعلى.</div>
      ) : (
        <ul className="space-y-3">
          {exams.map((ex) => (
            <li key={ex.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-small font-bold">{ex.title}</span>
                    {ex.questions_count === 0 && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">بدون أسئلة</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {ex.questions_count} أسئلة · {ex.duration_minutes} دقيقة
                    {ex.total_marks ? ` · ${ex.total_marks} درجات` : ""}
                    {ex.attempts_count > 0 && ` · ${ex.attempts_count} محاولة محلولة`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/exam/${ex.id}`} className="btn-secondary !px-4 !py-1.5 text-xs">معاينة وحل</a>
                  <button onClick={() => copyLink(ex.id)} className="btn-secondary !px-4 !py-1.5 text-xs">
                    {copiedId === ex.id ? "✓ تم النسخ" : "نسخ رابط الطلاب"}
                  </button>
                  <button onClick={() => onDelete(ex.id, ex.title, ex.attempts_count)}
                    disabled={deletingId === ex.id}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/10 disabled:opacity-50">
                    {deletingId === ex.id ? "جاري الحذف..." : "حذف"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
