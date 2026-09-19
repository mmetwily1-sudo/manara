"use client";

import { useEffect, useState } from "react";
import { TeacherDraftCard } from "@/components/TeacherDraftCard";

type Q = { id: string; subject: string; lesson: string | null; difficulty: number; qtype: string; body: string; marks: number };

export default function QuestionsPage() {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [filter, setFilter] = useState({ subject: "", difficulty: "" });
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [stats, setStats] = useState<{ total: number; byLevel: Record<number, number> } | null>(null);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [form, setForm] = useState({ body: "", subject: "", lesson: "", difficulty: "2", qtype: "mcq", options: "", correct: "", marks: "1", sourceDetail: "", share: false });
  const [busy, setBusy] = useState(false);
  // مسح الصور
  const [showScan, setShowScan] = useState(false);
  const [scanFiles, setScanFiles] = useState<FileList | null>(null);
  const [scanSubject, setScanSubject] = useState("");
  const [scanTitle, setScanTitle] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  // مسوداتي
  const [drafts, setDrafts] = useState<any[] | null>(null);

  async function loadDrafts() {
    try {
      const r = await fetch("/api/questions/drafts");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDrafts(j.drafts ?? []);
    } catch {}
  }
  useEffect(() => { loadDrafts(); }, []);

  async function onScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanFiles?.length) { setErr("اختر صورة واحدة على الأقل."); return; }
    setScanBusy(true); setErr(""); setOkMsg("");
    try {
      const fd = new FormData();
      Array.from(scanFiles).slice(0, 8).forEach((f) => fd.append("images", f));
      if (scanSubject.trim()) fd.set("subject", scanSubject.trim());
      if (scanTitle.trim()) fd.set("examTitle", scanTitle.trim());
      const r = await fetch("/api/questions/scan", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg(`تم إنشاء ${j.drafts} مسودة من ${j.pages} صفحات${j.ocr ? " (بمساعدة OCR)" : " (انسخ من الصور)"}${j.examId ? " — مربوطة بامتحان جديد غير منشور" : ""}. راجعها بالأسفل.`);
        setScanFiles(null); setScanTitle("");
        setShowScan(false);
        loadDrafts();
      } else setErr(j?.message ?? "فشل المسح: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setScanBusy(false); }
  }

  async function onDraftAct(id: string, action: "approve" | "delete", edits?: any) {
    setErr(""); setOkMsg("");
    try {
      const r = await fetch("/api/questions/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(edits ?? {}) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg(action === "approve" ? (j.linkedExam ? "تم الاعتماد والإرفاق بالامتحان ✅" : "تم الاعتماد ✅") : "تم حذف المسودة.");
        loadDrafts(); load();
      } else setErr(j?.message ?? "فشل: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }


  // ربط المنهج (اختياري)
  const [tracks, setTracks] = useState<{ code: string; system: string; grade_ar: string; stream_ar: string | null }[]>([]);
  const [linkTrack, setLinkTrack] = useState("");
  const [linkSubjects, setLinkSubjects] = useState<string[]>([]);
  const [linkSubject, setLinkSubject] = useState("");
  const [linkLessons, setLinkLessons] = useState<{ code: string; lesson_title: string; unit_title: string }[]>([]);
  const [linkLesson, setLinkLesson] = useState("");
  const [linkBooks, setLinkBooks] = useState<{ id: string; name: string }[]>([]);
  const [linkBook, setLinkBook] = useState("");

  async function load() {
    try {
      const p = new URLSearchParams();
      if (filter.subject) p.set("subject", filter.subject);
      if (filter.difficulty) p.set("difficulty", filter.difficulty);
      const r = await fetch(`/api/questions?${p.toString()}`);
      const j = await r.json().catch(() => null);
      setQs(r.ok && j?.ok ? (j.questions ?? []) : []);
      if (!r.ok) setErr("تعذر تحميل الأسئلة.");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, [filter]);
  // رابط قادم من صفحة الامتحانات: ?subject= → تعبئة الفلتر + فتح نموذج الإضافة
  // ?scan=1 → فتح نموذج المسح مباشرة
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("scan") === "1") setShowScan(true);
      const s = q.get("subject");
      if (s) {
        setFilter((f) => ({ ...f, subject: s }));
        setForm((f) => ({ ...f, subject: s }));
        setShowAdd(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    fetch("/api/questions/stats").then((r) => r.json()).then((j) => {
      if (j?.ok) setStats({ total: j.total, byLevel: j.byLevel });
    }).catch(() => {});
    fetch("/api/curriculum/tracks").then((r) => r.json()).then((j) => {
      if (j?.ok) setTracks(j.tracks ?? []);
    }).catch(() => {});
  }, []);

  async function onLinkTrack(code: string) {
    setLinkTrack(code); setLinkSubject(""); setLinkSubjects([]); setLinkLesson(""); setLinkLessons([]); setLinkBook(""); setLinkBooks([]);
    if (!code) return;
    const j = await fetch(`/api/curriculum/outline?trackCode=${encodeURIComponent(code)}`).then((r) => r.json()).catch(() => null);
    if (j?.ok) setLinkSubjects(j.subjects ?? []);
  }

  async function onLinkSubject(s: string) {
    setLinkSubject(s); setLinkLesson(""); setLinkLessons([]); setLinkBook(""); setLinkBooks([]);
    if (linkTrack && s) {
      if (!form.subject) setForm((f) => ({ ...f, subject: s }));
      const j = await fetch(`/api/curriculum/outline?trackCode=${encodeURIComponent(linkTrack)}&subject=${encodeURIComponent(s)}`).then((r) => r.json()).catch(() => null);
      if (j?.ok) {
        const ls: { code: string; lesson_title: string; unit_title: string }[] = [];
        (j.units ?? []).forEach((u: any) => u.lessons.forEach((l: any) => ls.push({ code: l.code, lesson_title: l.lesson_title, unit_title: u.unit_title })));
        setLinkLessons(ls);
        setLinkBooks(j.books ?? []);
      }
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setOkMsg("");
    const options = form.options.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const r = await fetch("/api/questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: form.body, subject: form.subject || "عام", lesson: form.lesson || null,
          difficulty: Number(form.difficulty) || 2, qtype: form.qtype,
          options: options.length ? options : null,
          correct_answer: form.correct || null, marks: Number(form.marks) || 1,
          lesson_code: linkLesson || null,
          book_id: linkBook || null,
          source: linkBook ? "book" : "teacher",
          source_detail: form.sourceDetail.trim() || null,
          share: form.share,
        }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg(j.pending_review ? "تم الحفظ وإرساله لمراجعة المنصة للنشر العام. ✅" : "تم حفظ السؤال.");
        setForm({ body: "", subject: "", lesson: "", difficulty: "2", qtype: "mcq", options: "", correct: "", marks: "1", sourceDetail: "", share: false });
        setLinkLesson(""); setLinkBook("");
        setShowAdd(false);
        setOkMsg("تم حفظ السؤال.");
        load();
      } else setErr("فشل الحفظ: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true); setErr(""); setOkMsg("");
    const fd = new FormData(); fd.set("file", f);
    const r = await fetch("/api/questions/import", { method: "POST", body: fd });
    const j = await r.json();
    if (j.ok) setOkMsg(`تم استيراد ${j.imported} سؤال (تخطي ${j.skipped})`);
    else setErr("فشل الاستيراد: " + (j?.error ?? "خطأ غير معروف"));
    setImporting(false); load();
  }

  async function onBulk(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setImporting(true); setErr(""); setOkMsg("");
    const fd = new FormData();
    fd.set("file", new Blob([bulkText], { type: "text/plain" }), "bulk.txt");
    fd.set("mode", "text");
    try {
      const r = await fetch("/api/questions/import", { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) { setOkMsg(`تم استيراد ${j.imported} سؤال (تخطي ${j.skipped})`); setBulkText(""); setShowBulk(false); }
      else setErr("فشل الاستيراد: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    setImporting(false); load();
  }

  function downloadTemplate() {
    const csv = "subject,lesson,difficulty,qtype,body,options,correct_answer,marks\n" +
      "رياضيات,الكسور,2,mcq,ما ناتج 1/2 + 1/4؟,1/2|3/4|1|2/3,3/4,2\n" +
      "علوم,,1,true_false,الماء يغلي عند 100 درجة مئوية,,صح,1\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "questions-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onShare(id: string) {
    if (!confirm("مشاركة هذا السؤال في البنك المركزي؟ سيراجعه فريق المنصة قبل النشر للجميع.")) return;
    setErr(""); setOkMsg("");
    const r = await fetch(`/api/questions/${id}/submit`, { method: "POST" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setOkMsg("أُرسل للمراجعة — سيظهر في البنك العام بعد الاعتماد. ✅"); load(); }
    else setErr(j?.message ?? "فشل الإرسال: " + (j?.error ?? "خطأ غير معروف"));
  }

  async function onDelete(id: string) {
    if (!confirm("حذف هذا السؤال من البنك؟")) return;
    setErr(""); setOkMsg("");
    const r = await fetch(`/api/questions?id=${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setOkMsg("تم حذف السؤال."); load(); }
    else setErr(j?.message ?? "فشل الحذف: " + (j?.error ?? "خطأ غير معروف"));
  }



  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">بنك الأسئلة</h1>
          <p className="mt-1 text-small text-slate-500">أسئلتك بمعادلات KaTeX وإستيراد Excel/CSV</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer text-small">
            {importing ? "جاري..." : "استيراد Excel/CSV"}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} disabled={importing} />
          </label>
          <button onClick={() => setShowBulk((v) => !v)} className="btn-secondary text-small">لصق أسئلة نصية</button>
          <button onClick={downloadTemplate} className="btn-secondary text-small">تحميل القالب</button>
          <button onClick={() => setShowScan((v) => !v)} className="btn-secondary text-small">مسح ورقة 📷</button>
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-small">سؤال جديد</button>
        </div>
      </header>

      {showScan && (
        <form onSubmit={onScan} className="card space-y-3 p-5">
          <h3 className="font-bold">مسح ورقة امتحان/أسئلة 📷</h3>
          <p className="text-xs leading-relaxed text-slate-500">
            صوّر الورقة أو ارفع صورها (حتى 8 صور) — نستخرج مسودات تلقائياً (OCR عند توفره) وتراجعها أنت من الصور قبل الاعتماد. لا شيء يُنشر وحده.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-small font-bold text-slate-600 transition hover:border-primary hover:text-primary">
            {scanFiles?.length ? `📎 ${scanFiles.length} صور مختارة` : "اختر الصور (كاميرا أو ملفات)"}
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => setScanFiles(e.target.files)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={scanSubject} onChange={(e) => setScanSubject(e.target.value)} placeholder="المادة (مثال: فيزياء)"
              className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
            <input value={scanTitle} onChange={(e) => setScanTitle(e.target.value)} placeholder="عنوان الامتحان (اختياري — ينشئ امتحاناً غير منشور ويُرفق به)"
              className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          </div>
          <button className="btn-primary" disabled={scanBusy}>{scanBusy ? "جاري المسح والمعالجة..." : "بدء المسح"}</button>
        </form>
      )}

      {drafts !== null && drafts.length > 0 && (
        <section className="card space-y-3 p-5">
          <h3 className="font-bold">مسوداتي للمراجعة ({drafts.length}) 📝</h3>
          <p className="text-xs text-slate-500">اقرأ من الصورة وصحّح — الاعتماد يتطلب نصاً واختيارات وإجابة.</p>
          <ul className="space-y-4">
            {drafts.map((d) => (
              <TeacherDraftCard key={d.id} draft={d} onAct={onDraftAct} />
            ))}
          </ul>
        </section>
      )}

      {stats && (
        <div className="card flex flex-wrap gap-x-6 gap-y-1 p-3 text-xs text-slate-600">
          <span>الإجمالي: <b>{stats.total}</b></span>
          {[1, 2, 3, 4, 5].map((d) => (
            <span key={d}>مستوى {d}: <b>{stats.byLevel?.[d] ?? 0}</b></span>
          ))}
        </div>
      )}

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {okMsg && <div className="card border-success/30 bg-success/5 p-4 text-small font-bold text-success">{okMsg}</div>}

      {showBulk && (
        <form onSubmit={onBulk} className="card space-y-3 p-5">
          <h3 className="font-bold">لصق أسئلة مجمعة</h3>
          <p className="text-xs leading-relaxed text-slate-500">
            سؤال لكل كتلة يفصلها سطر فارغ — السطر الأول نص السؤال، ثم الاختيارات (أ، ب، ج...)، وسطر <code dir="ltr">=: الإجابة</code> للصحيحة.
            مثال:
          </p>
          <pre dir="rtl" className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">ما ناتج 2+2؟{"\n"}أ) 3{"\n"}ب) 4{"\n"}ج) 5{"\n"}=: 4</pre>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8}
            placeholder="الصق أسئلتك هنا..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
          <button className="btn-primary" disabled={importing || !bulkText.trim()}>{importing ? "جاري الاستيراد..." : "استيراد النص"}</button>
        </form>
      )}

      {showAdd && (
        <form onSubmit={onAdd} className="card grid gap-3 p-5 sm:grid-cols-2">
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="نص السؤال (يدعم $LaTeX$)" required rows={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="المادة" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <input value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} placeholder="الدرس (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <select value={form.qtype} onChange={(e) => setForm({ ...form, qtype: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <option value="mcq">اختيار من متعدد</option>
            <option value="true_false">صح / خطأ</option>
            <option value="short_answer">إجابة قصيرة</option>
          </select>
          <div className="flex items-center gap-2">
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
              <option value="1">1 سهل</option>
              <option value="2">2 متوسط</option>
              <option value="3">3 صعب</option>
            </select>
            <input value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} placeholder="الدرجات" inputMode="decimal" className="w-24 rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          </div>
          <textarea value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="الاختيارات — سطر لكل اختيار (لـ mcq)" rows={3} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" dir="ltr" style={{ textAlign: "right" }} />
          <input value={form.correct} onChange={(e) => setForm({ ...form, correct: e.target.value })} placeholder="الإجابة الصحيحة (نص مطابق لأحد الاختيارات)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <input value={form.sourceDetail} onChange={(e) => setForm({ ...form, sourceDetail: e.target.value })} placeholder="المرجع (اختياري): امتحان ثانوية 2023 دور أول — س 5" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <label className="flex cursor-pointer items-center gap-2 text-small font-bold text-slate-600 sm:col-span-2">
            <input type="checkbox" checked={form.share} onChange={(e) => setForm({ ...form, share: e.target.checked })} className="h-4 w-4 accent-success" />
            مشاركة في البنك المركزي 🌍 (يراجعها فريق المنصة قبل النشر — شارك أسئلتك الأصلية فقط)
          </label>
          {tracks.length > 0 && (
            <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary-light/20 p-3 sm:col-span-2 sm:grid-cols-3">
              <div className="sm:col-span-3 text-xs font-bold text-primary">ربط بالمنهج والكتاب (اختياري — يدخل السؤال في التوليد المرجعي)</div>
              <select value={linkTrack} onChange={(e) => onLinkTrack(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
                <option value="">المسار…</option>
                {tracks.map((t) => <option key={t.code} value={t.code}>{t.system === "azhar" ? "أزهر" : "عام"} · {t.grade_ar}{t.stream_ar ? ` · ${t.stream_ar}` : ""}</option>)}
              </select>
              <select value={linkSubject} onChange={(e) => onLinkSubject(e.target.value)} disabled={!linkTrack} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
                <option value="">المادة…</option>
                {linkSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={linkLesson} onChange={(e) => setLinkLesson(e.target.value)} disabled={!linkLessons.length} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
                <option value="">الدرس…</option>
                {linkLessons.map((l) => <option key={l.code} value={l.code}>{l.unit_title} — {l.lesson_title}</option>)}
              </select>
              {linkBooks.length > 0 && (
                <select value={linkBook} onChange={(e) => setLinkBook(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small sm:col-span-3">
                  <option value="">تأليف المعلم (بدون كتاب)</option>
                  {linkBooks.map((b) => <option key={b.id} value={b.id}>من كتاب: {b.name}</option>)}
                </select>
              )}
            </div>
          )}
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ السؤال"}</button>
        </form>
      )}

      <div className="card flex flex-wrap gap-2 p-3 text-xs">
        <input placeholder="المادة" value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-1.5 outline-none" />
        <select value={filter.difficulty} onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-1.5">
          <option value="">كل المستويات</option>
          <option value="1">1 سهل</option>
          <option value="2">2 متوسط</option>
          <option value="3">3 صعب</option>
        </select>
        <span className="ml-auto text-slate-400">القالب: subject | lesson | difficulty | qtype | body | options | correct_answer | marks</span>
      </div>

      {qs === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الأسئلة...</div>
      ) : qs.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا توجد أسئلة بعد — أضف أول سؤال بالزر بالأعلى أو استورد ملف Excel.</div>
      ) : (
      <ul className="space-y-3">
        {qs.map((q) => (
          <li key={q.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-small font-bold">
                {q.body}
                <span className="mt-1 flex flex-wrap gap-1">
                  {(q as any).shared && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">🌍 بنك عام</span>}
                  {(q as any).status === "pending" && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">⏳ بانتظار مراجعة المنصة</span>}
                  {(q as any).status === "rejected" && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">مرفوض من المنصة</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-bold text-primary">صعوبة {q.difficulty} · {q.marks} درجات</span>
                {!(q as any).shared && (q as any).status !== "pending" && (
                  <button onClick={() => onShare(q.id)} aria-label="مشاركة في البنك العام"
                    className="rounded-lg px-2 py-0.5 text-xs font-bold text-success transition hover:bg-success/10">مشاركة 🌍</button>
                )}
                {!(q as any).shared && (
                  <button onClick={() => onDelete(q.id)} aria-label="حذف السؤال"
                    className="rounded-lg px-2 py-0.5 text-xs font-bold text-danger transition hover:bg-danger/10">حذف</button>
                )}
              </div>
            </div>
            <div className="mt-2 flex gap-2 text-xs text-slate-500">
              <span>{q.subject}</span>
              {q.lesson && <><span>·</span><span>{q.lesson}</span></>}
              <span>·</span><span>{q.qtype}</span>
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
