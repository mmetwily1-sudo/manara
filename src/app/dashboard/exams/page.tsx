"use client";

import { useEffect, useState } from "react";
import ExamCodesManager from "@/components/ExamCodesManager";
import SuspicionPanel from "@/components/SuspicionPanel";

type ExamRow = {
  id: string; title: string; duration_minutes: number; total_marks: number;
  is_published: boolean; require_code?: boolean; is_archived?: boolean; questions_count: number; attempts_count: number; pending_drafts?: number;
};
type AuditReport = {
  total: number; fixed: string[];
  warnings: { n: number; question_id: string; body: string; issues: string[]; suggested?: string | null }[];
  llm: { checked: number; skipped: string | null };
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
  const [notice, setNotice] = useState<{ kind: "ok" | "err" | "warn"; text: string; link?: { href: string; label: string } } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", easy: 2, mid: 2, hard: 1, duration: 30 });
  const [tpls, setTpls] = useState<{ id: string; title: string; questions: number }[] | null>(null);
  const [tplId, setTplId] = useState("");
  const [tplBusy, setTplBusy] = useState(false);

  async function loadTemplates() {
    try {
      const { r, j } = await apiFetch("/api/exam-templates");
      if (r.ok && j?.ok) setTpls(j.templates);
      else setNotice({ kind: "err", text: "تعذر تحميل القوالب." });
    } catch { setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." }); }
  }

  async function onSaveTemplate(id: string, title: string) {
    try {
      const { r, j } = await apiFetch("/api/exam-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", exam_id: id }),
      });
      if (r.ok && j?.ok) { setNotice({ kind: "ok", text: `حُفظ "${title}" كقالب (${j.questions} أسئلة).` }); setTpls(null); }
      else setNotice({ kind: "err", text: "فشل الحفظ." });
    } catch { setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." }); }
  }

  const [analysis, setAnalysis] = useState<{ title: string; attempts: number; hardest: { body: string; tried: number; rate: number | null }[]; failed: { student_id: string; name: string; phone: string | null; score: number; total: number }[] } | null>(null);

  async function onVariants(id: string) {
    if (!confirm("إنشاء نموذجين متوازيين A/B من هذا الامتحان كمسودتين؟")) return;
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}/variants`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 2 }),
      });
      if (r.ok && j?.ok) { setNotice({ kind: "ok", text: `تم إنشاء ${j.count} نماذج متوازية كمسودات.` }); loadAll(); }
      else setNotice({ kind: "err", text: j?.error === "too_few_questions" ? "أسئلة غير كافية لنموذجين." : "فشل الإنشاء." });
    } catch { setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." }); }
  }

  async function onAnalysis(id: string, title: string) {
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}/analysis`);
      if (r.ok && j?.ok) setAnalysis({ title, attempts: j.attempts, hardest: j.hardest, failed: j.failed });
      else setNotice({ kind: "err", text: "تعذر التحليل." });
    } catch { setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." }); }
  }

  async function onUseTemplate() {
    if (!tplId) return;
    setTplBusy(true);
    try {
      const { r, j } = await apiFetch("/api/exam-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", template_id: tplId }),
      });
      if (r.ok && j?.ok) { setNotice({ kind: "ok", text: `أُنشئت مسودة من القالب (${j.questions} أسئلة) — راجعها وانشرها.` }); loadAll(); }
      else setNotice({ kind: "err", text: "فشل الإنشاء." });
    } catch { setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." }); }
    finally { setTplBusy(false); }
  }
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [audits, setAudits] = useState<Record<string, AuditReport>>({});

  async function onAudit(id: string) {
    setAuditingId(id);
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}/audit`, { method: "POST" });
      if (r.ok && j?.ok) {
        setAudits((p) => ({ ...p, [id]: j as AuditReport }));
        loadAll();
      } else setNotice({ kind: "err", text: "فشل التدقيق: " + (j?.error ?? "خطأ غير معروف") });
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." });
    } finally {
      setAuditingId(null);
    }
  }
  // المنهج المرجعي (وضع curriculum) — اختياري: بدونه يعمل التوليد القديم
  const [tracks, setTracks] = useState<{ code: string; system: string; grade_ar: string; stream_ar: string | null }[]>([]);
  const [currReady, setCurrReady] = useState<boolean | null>(null);
  const [trackCode, setTrackCode] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [units, setUnits] = useState<{ subject: string; unit_no: number; unit_title: string; lessons: { code: string; lesson_title: string; weight: number; bank_count: number }[] }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [coverage, setCoverage] = useState<Record<string, { title: string; wanted: number; picked: number; available: number }> | null>(null);

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

  useEffect(() => {
    apiFetch("/api/curriculum/tracks").then(({ r, j }) => {
      if (r.ok && j?.ok) { setTracks(j.tracks ?? []); setCurrReady(true); }
      else setCurrReady(false);
    }).catch(() => setCurrReady(false));
  }, []);

  async function onTrack(code: string) {
    setTrackCode(code); setSubject(""); setSubjects([]); setUnits([]); setPicked(new Set()); setCoverage(null);
    if (!code) return;
    const { r, j } = await apiFetch(`/api/curriculum/outline?trackCode=${encodeURIComponent(code)}`);
    if (r.ok && j?.ok) setSubjects(j.subjects ?? []);
  }

  async function onSubject(s: string) {
    setSubject(s); setUnits([]); setPicked(new Set()); setCoverage(null);
    if (!s) return;
    const { r, j } = await apiFetch(`/api/curriculum/outline?trackCode=${encodeURIComponent(trackCode)}&subject=${encodeURIComponent(s)}`);
    if (r.ok && j?.ok) {
      setUnits(j.units ?? []);
      const all = new Set<string>();
      (j.units ?? []).forEach((u: any) => u.lessons.forEach((l: any) => all.add(l.code)));
      setPicked(all);
    }
  }

  function toggleLesson(code: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

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
    setCoverage(null);
    try {
      const useCurr = trackCode && subject;
      const { r, j } = await apiFetch("/api/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          duration: form.duration,
          distribution: { 1: form.easy, 2: form.mid, 3: form.hard },
          ...(useCurr ? { trackCode, subject, lessonCodes: Array.from(picked) } : {}),
        }),
      });
      if (r.ok && j?.ok) {
        if (j.mode === "curriculum" && j.coverage) setCoverage(j.coverage);
        const parts = useCurr
          ? `${j.picked} سؤال من منهج ${subject}`
          : Object.entries(j.pickedCount ?? {})
              .filter(([, n]) => Number(n) > 0)
              .map(([d, n]) => `${n} ${LEVEL_LABELS[d] ?? ""}`)
              .join(" + ");
        setNotice({
          kind: j.shortfall ? "warn" : "ok",
          text: j.shortfall
            ? `تم إنشاء الامتحان بـ ${j.picked} أسئلة فقط (${parts}) — بنك الأسئلة يحتاج أسئلة أكثر في الدروس الناقصة.`
            : `تم إنشاء الامتحان بنجاح (${parts || j.picked + " أسئلة"}).`,
        });
        setForm((f) => ({ ...f, title: "" }));
        loadAll();
      } else if (j?.error === "empty_bank") {
        const d = j.diagnostics ?? {};
        const bankLink = { href: `/dashboard/questions${d.subject ? `?subject=${encodeURIComponent(d.subject)}` : ""}`, label: "فتح بنك الأسئلة" };
        if (d.subject && (d.unlinkedInSubject ?? 0) > 0) {
          setNotice({
            kind: "err",
            text: `لا توجد أسئلة مربوطة بدروس ${d.subject} — لكن عندك ${d.unlinkedInSubject} سؤال في نفس المادة بلا ربط. اربطها بالدروس من بنك الأسئلة ثم ولّد مجدداً.`,
            link: bankLink,
          });
        } else if (d.subject) {
          setNotice({
            kind: "err",
            text: `لا توجد أسئلة لمادة ${d.subject} في بنكك (${d.lessonsWithBank ?? 0}/${d.lessonsTotal ?? 0} درس مغطى). أضف أسئلة مربوطة بالدروس أولاً.`,
            link: bankLink,
          });
        } else {
          setNotice({ kind: "err", text: "بنك الأسئلة فارغ — أضف أسئلة أولاً ثم ولّد الامتحان.", link: bankLink });
        }
      } else {
        setNotice({ kind: "err", text: j?.error === "unauth" ? "انتهت جلستك — سجّل دخولك مجدداً." : `فشل التوليد: ${j?.error ?? "خطأ غير معروف"}` });
      }
    } catch {
      setNotice({ kind: "err", text: "انتهت مهلة الاتصال — تحقق من الإنترنت وحاول مجدداً. لو تكرر، قلل عدد الأسئلة." });
    } finally {
      setGenerating(false);
    }
  }

  const [showArchived, setShowArchived] = useState(false);

  async function onArchive(id: string, v: boolean) {
    if (v && !confirm("أرشفة هذا الامتحان؟ (يختفي من القائمة ويمكن استعادته)")) return;
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: v }),
      });
      if (r.ok && j?.ok) {
        setExams((prev) => (prev ?? []).map((e) => (e.id === id ? { ...e, is_archived: v } : e)));
      } else setNotice({ kind: "err", text: "فشل الأرشفة." });
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." });
    }
  }

  async function onRequireCode(id: string, v: boolean) {
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ require_code: v }),
      });
      if (r.ok && j?.ok) {
        setExams((prev) => (prev ?? []).map((e) => (e.id === id ? { ...e, require_code: v } : e)));
        setNotice({ kind: "ok", text: v ? "تم تفعيل الدخول بالأكواد — ولّد أكواد الطلاب من إدارة الأكواد." : "تم إيقاف الدخول بالأكواد." });
      } else setNotice({ kind: "err", text: "فشل التحديث." });
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." });
    }
  }

  async function onPublish(id: string, publish: boolean) {
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: publish }),
      });
      if (r.ok && j?.ok) {
        setExams((prev) => (prev ?? []).map((e) => (e.id === id ? { ...e, is_published: publish } : e)));
        setNotice({ kind: "ok", text: publish ? "تم نشر الامتحان — أصبح متاحاً للطلاب." : "تم إخفاء الامتحان عن الطلاب." });
      } else setNotice({ kind: "err", text: "فشل التحديث." });
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." });
    }
  }

  async function onDuplicate(id: string) {
    if (!confirm("نسخ هذا الامتحان بكل أسئلته كمسودة جديدة؟ (تُراجع قبل النشر)")) return;
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}/duplicate`, { method: "POST" });
      if (r.ok && j?.ok) {
        setNotice({ kind: "ok", text: `تم النسخ (${j.questions} أسئلة) — راجعه وانشره.` });
        loadAll();
      } else setNotice({ kind: "err", text: "فشل النسخ." });
    } catch { setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." }); }
  }

  async function onPurgeImages(id: string) {
    if (!confirm("حذف صور المسح الأصلية؟ (الأسئلة النصية المعتمدة تبقى كما هي)")) return;
    try {
      const { r, j } = await apiFetch(`/api/exams/${id}/source-images`, { method: "DELETE" });
      if (r.ok && j?.ok) setNotice({ kind: "ok", text: `تم حذف ${j.removed} صور مصدر.` });
      else setNotice({ kind: "err", text: "فشل الحذف." });
    } catch {
      setNotice({ kind: "err", text: "تعذر الاتصال بالخادم." });
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
          {notice.link && (
            <a href={notice.link.href} className="mt-2 inline-block rounded-lg bg-white/70 px-4 py-1.5 underline">
              {notice.link.label} ←
            </a>
          )}
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

      <div className="flex flex-wrap gap-2">
        <a href="/dashboard/questions?scan=1" className="btn-secondary text-small">امتحان من صور ورقية 📷</a>
      </div>

      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">توليد امتحان جديد</h2>
          <div className="flex flex-wrap gap-2">
            {([
              ["شهري 📝", { title: "اختبار شهري — ", easy: 3, mid: 4, hard: 3, duration: 45 }],
              ["كويز ⚡", { title: "كويز سريع — ", easy: 1, mid: 2, hard: 1, duration: 15 }],
              ["نهائي 🎓", { title: "امتحان نهائي — ", easy: 5, mid: 8, hard: 5, duration: 90 }],
            ] as const).map(([label, p]) => (
              <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, ...p }))}
                className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white">
                قالب {label}
              </button>
            ))}
            <button type="button" onClick={loadTemplates} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
              📑 من قالب محفوظ
            </button>
          </div>
        </div>
        {tpls !== null && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
            {tpls.length === 0 ? (
              <span className="text-xs text-slate-400">لا قوالب محفوظة بعد — احفظ أي امتحان كقالب بزر 📑 بجانبه.</span>
            ) : (
              <>
                <select value={tplId} onChange={(e) => setTplId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
                  <option value="">اختر قالباً…</option>
                  {tpls.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.questions} سؤال)</option>)}
                </select>
                <button type="button" onClick={onUseTemplate} disabled={!tplId || tplBusy} className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50">
                  {tplBusy ? "جاري..." : "إنشاء مسودة من القالب"}
                </button>
              </>
            )}
          </div>
        )}
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
          {currReady && (
            <div className="rounded-xl border border-primary/20 bg-primary-light/30 p-4">
              <div className="mb-2 text-xs font-bold text-primary">التوليد من المنهج 📚 (اختياري — يوزع الأسئلة على الدروس بأوزانها)</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">المسار الدراسي</label>
                  <select value={trackCode} onChange={(e) => onTrack(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                    <option value="">بدون منهج (عشوائي من البنك)</option>
                    {tracks.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.system === "azhar" ? "أزهر" : "عام"} · {t.grade_ar}{t.stream_ar ? ` · ${t.stream_ar}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {trackCode && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">المادة</label>
                    <select value={subject} onChange={(e) => onSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                      <option value="">اختر المادة…</option>
                      {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {units.length > 0 && (
                <div className="mt-3 space-y-3">
                  {units.map((u) => (
                    <div key={`${u.subject}-${u.unit_no}`}>
                      <div className="mb-1 text-xs font-bold text-slate-600">الوحدة {u.unit_no}: {u.unit_title}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {u.lessons.map((l) => {
                          const on = picked.has(l.code);
                          return (
                            <button key={l.code} type="button" onClick={() => toggleLesson(l.code)}
                              title={`الوزن ${l.weight}% · في بنكك: ${l.bank_count}`}
                              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${on ? "bg-primary text-white" : "bg-slate-100 text-slate-400 line-through"}`}>
                              {l.lesson_title} <span className="opacity-75">({l.bank_count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400">الرقم بين القوسين = أسئلة هذا الدرس في بنكك — الدرس الفارغ سيُتجاهل تلقائياً.</p>
                </div>
              )}
            </div>
          )}
          {(() => {
            const useCurr = Boolean(trackCode && subject);
            const selBank = useCurr
              ? units.flatMap((u) => u.lessons).filter((l) => picked.has(l.code)).reduce((s, l) => s + (l.bank_count ?? 0), 0)
              : -1;
            return (
              <>
                {useCurr && selBank === 0 && (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-small font-bold text-warning">
                    الدروس المحددة بلا أسئلة مربوطة في بنكك —{" "}
                    <a href={`/dashboard/questions?subject=${encodeURIComponent(subject)}`} className="underline">أضف أسئلة لمادة {subject} أولاً</a>
                  </div>
                )}
                <button
                  className="btn-primary w-full sm:w-auto sm:px-10"
                  disabled={generating || bankEmpty || (useCurr && selBank === 0)}
                >
                  {generating ? "جاري التوليد... (قد يستغرق ثواني)" : "توليد الامتحان الآن"}
                </button>
              </>
            );
          })()}
        </form>
      </div>

      {coverage && (
        <div className="card space-y-2 p-5">
          <h3 className="font-bold">تغطية الدروس 📊</h3>
          <ul className="space-y-1.5">
            {Object.entries(coverage).map(([code, c]) => (
              <li key={code} className="flex items-center justify-between gap-3 text-small">
                <span className={c.picked < c.wanted ? "font-bold text-warning" : ""}>{c.title}</span>
                <span className="text-xs text-slate-500">اختير {c.picked}/{c.wanted} · متاح {c.available}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis && (
        <div className="card space-y-3 border-primary/20 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">تحليل «{analysis.title}» 📊 <span className="text-xs font-normal text-slate-400">({analysis.attempts} محاولة)</span></h2>
            <button onClick={() => setAnalysis(null)} className="text-xs text-slate-400">إغلاق ✕</button>
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-slate-500">أصعب الأسئلة (أقل نسبة صواب):</div>
            {analysis.hardest.length === 0 ? <div className="text-xs text-slate-400">لا محاولات بعد.</div> :
              analysis.hardest.map((h, i) => (
                <div key={i} className="text-xs text-slate-600">• {h.body || "(بلا نص)"} — <b className="text-danger">{h.rate !== null ? `${h.rate}%` : "—"}</b> <span className="text-slate-400">({h.tried})</span></div>
              ))}
          </div>
          <div>
            <div className="mb-1 text-xs font-bold text-slate-500">راسبون &lt;50% ({analysis.failed.length}) — إعادة مستحقة 🔁:</div>
            {analysis.failed.length === 0 ? <div className="text-xs font-bold text-success">لا راسبين 🎉</div> :
              analysis.failed.slice(0, 20).map((f) => {
                const link = f.phone ? `https://wa.me/${String(f.phone).replace(/[^\d]/g, "")}?text=${encodeURIComponent(`تنبيه من سنترنا: ${f.name} حصل على ${f.score}/${f.total} — يستحق فرصة إعادة، تواصل معنا لتحديد الموعد 🔁`)}` : null;
                return (
                  <div key={f.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span><b>{f.name}</b> — {f.score}/{f.total}</span>
                    {link && <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-3 py-1 font-bold text-white">دعوة إعادة 💬</a>}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {exams === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الامتحانات...</div>
      ) : exams.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">لا توجد امتحانات بعد — ولّد أول امتحان من الأعلى.</div>
      ) : (
        <>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{exams.filter((e) => !e.is_archived).length} نشطاً</span>
          <button onClick={() => setShowArchived((v) => !v)} className="text-xs font-bold text-slate-500 underline">
            {showArchived ? "إخفاء الأرشيف" : `عرض الأرشيف (${exams.filter((e) => e.is_archived).length})`}
          </button>
        </div>
        <ul className="space-y-3">
          {exams.filter((ex) => showArchived || !ex.is_archived).map((ex) => (
            <li key={ex.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-small font-bold">{ex.title}</span>
                    {ex.questions_count === 0 && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">بدون أسئلة</span>
                    )}
                    {!ex.is_published ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">مسودة</span>
                    ) : (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">منشور</span>
                    )}
                    {ex.require_code && (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary">🔐 بالأكواد</span>
                    )}
                    {ex.is_archived && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">📦 مؤرشف</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {ex.questions_count} أسئلة · {ex.duration_minutes} دقيقة
                    {ex.total_marks ? ` · ${ex.total_marks} درجات` : ""}
                    {ex.attempts_count > 0 && ` · ${ex.attempts_count} محاولة محلولة`}
                  </div>
                  {(ex.pending_drafts ?? 0) > 0 && (
                    <div className="mt-1 text-xs font-bold text-warning">
                      ⏳ {ex.pending_drafts} مسودات لهذا الامتحان بانتظار مراجعتك —{" "}
                      <a href="/dashboard/questions" className="underline underline-offset-2">راجعها من بنك الأسئلة</a>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ex.questions_count > 0 && (
                    <button onClick={() => onAudit(ex.id)} disabled={auditingId === ex.id}
                      className="rounded-lg bg-primary-light px-4 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white disabled:opacity-50">
                      {auditingId === ex.id ? "جاري التدقيق..." : "تدقيق تلقائي 🔍"}
                    </button>
                  )}
                  <a href={`/exam/${ex.id}`} className="btn-secondary !px-4 !py-1.5 text-xs">معاينة وحل</a>
                  <a href={`/dashboard/exams/${ex.id}/print`} target="_blank" rel="noreferrer" className="btn-secondary !px-4 !py-1.5 text-xs">طباعة 🖨️</a>
                  <button onClick={() => onDuplicate(ex.id)}
                    className="rounded-lg bg-primary-light px-4 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white">
                    نسخ 📋
                  </button>
                  <button onClick={() => onSaveTemplate(ex.id, ex.title)}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100">
                    حفظ كقالب 📑
                  </button>
                  <button onClick={() => onVariants(ex.id)}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100">
                    نماذج A/B ⚖️
                  </button>
                  <button onClick={() => onAnalysis(ex.id, ex.title)}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100">
                    تحليل وراسبون 📊
                  </button>
                  <button onClick={() => copyLink(ex.id)} className="btn-secondary !px-4 !py-1.5 text-xs">
                    {copiedId === ex.id ? "✓ تم النسخ" : "نسخ رابط الطلاب"}
                  </button>
                  <button onClick={() => onPublish(ex.id, !ex.is_published)}
                    className="rounded-lg bg-primary-light px-4 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white">
                    {ex.is_published ? "إخفاء" : "نشر"}
                  </button>
                  <button onClick={() => onPurgeImages(ex.id)}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100">
                    حذف صور المسح
                  </button>
                  <button onClick={() => onArchive(ex.id, !ex.is_archived)}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100">
                    {ex.is_archived ? "استعادة" : "أرشفة"}
                  </button>
                  <button onClick={() => onDelete(ex.id, ex.title, ex.attempts_count)}
                    disabled={deletingId === ex.id}
                    className="rounded-lg px-4 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/10 disabled:opacity-50">
                    {deletingId === ex.id ? "جاري الحذف..." : "حذف"}
                  </button>
                </div>
              </div>
              <ExamCodesManager examId={ex.id} required={!!ex.require_code} onToggleRequire={(v) => onRequireCode(ex.id, v)} />
              <SuspicionPanel examId={ex.id} attempts={ex.attempts_count} />
              {audits[ex.id] && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed">
                  <div className="font-bold">نتيجة التدقيق ({audits[ex.id].total} أسئلة، تحقق لغوي: {audits[ex.id].llm.checked}
                    {audits[ex.id].llm.skipped ? ` — تُخطي: ${audits[ex.id].llm.skipped === "no_key" ? "لا مفتاح رؤية" : "الخدمة مشغولة"}` : " ✅"})
                  </div>
                  {audits[ex.id].fixed.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-success">
                      {audits[ex.id].fixed.map((f, i) => <li key={i}>🔧 {f}</li>)}
                    </ul>
                  )}
                  {audits[ex.id].warnings.length === 0 ? (
                    <div className="mt-1 font-bold text-success">كل الأسئلة سليمة ✅ — جاهز للنشر.</div>
                  ) : (
                    <ul className="mt-1 space-y-1 text-warning">
                      {audits[ex.id].warnings.map((w) => (
                        <li key={w.question_id}>⚠️ س{w.n} «{w.body}…»: {w.issues.join("؛ ")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
