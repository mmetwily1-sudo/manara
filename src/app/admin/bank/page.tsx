"use client";

import { useEffect, useState } from "react";

type Pending = {
  id: string; subject: string; lesson: string | null; lesson_code: string | null;
  difficulty: number; qtype: string; body: string; options: string[] | null;
  correct_answer: string | null; marks: number; source: string | null;
  tenant_name: string; created_at: string;
};
type Data = {
  ok: boolean;
  stats: { sharedTotal: number; pendingCount: number; bySubject: Record<string, number>; gapsTotal: number };
  pending: Pending[];
  gaps: { track: string; subject: string; lesson: string; code: string }[];
};

type Suggest = { id: string; body: string; suggestions: { code: string; lesson_title: string; unit_title: string; score: number; matched: string[]; other_track?: boolean; track_label?: string }[] };

function DraftCard({ draft, busy, onDone, onBusy }: { draft: any; busy: boolean; onDone: () => void; onBusy: (b: boolean) => void }) {
  const [body, setBody] = useState(draft.body ?? "");
  const [options, setOptions] = useState(((draft.options ?? []) as string[]).join("\n"));
  const [correct, setCorrect] = useState(draft.correct_answer ?? "");
  const [lesson, setLesson] = useState("");
  const [msg, setMsg] = useState("");

  async function act(action: "approve_draft" | "delete_draft") {
    if (action === "delete_draft" && !confirm("حذف هذه المسودة نهائياً؟")) return;
    onBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/bank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id, action, body,
          options: options.split("\n").map((s) => s.trim()).filter(Boolean),
          correct_answer: correct, lesson_code: lesson || undefined,
        }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) onDone();
      else setMsg(j?.message ?? "فشل: " + (j?.error ?? "خطأ"));
    } catch { setMsg("تعذر الاتصال."); }
    finally { onBusy(false); }
  }

  return (
    <li className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
      <div>
        <div className="mb-1 text-xs font-bold text-slate-500">صفحة الامتحان الأصلية {draft.draft_page ? `(ص ${draft.draft_page})` : ""}</div>
        {draft.page_url ? (
          <a href={draft.page_url} target="_blank" rel="noreferrer">
            <img src={draft.page_url} alt="صفحة الامتحان" className="max-h-96 w-full rounded-lg border object-contain" loading="lazy" />
          </a>
        ) : (
          <p className="text-xs text-slate-400">لا توجد صورة.</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600">نص السؤال (صحّحه من الصورة)</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary" />
        <label className="block text-xs font-bold text-slate-600">الاختيارات (سطر لكل اختيار)</label>
        <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} dir="ltr" style={{ textAlign: "right" }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary" />
        <label className="block text-xs font-bold text-slate-600">الإجابة الصحيحة (نص مطابق)</label>
        <input value={correct} onChange={(e) => setCorrect(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-small outline-none focus:border-primary" />
        <label className="block text-xs font-bold text-slate-600">كود الدرس (اختياري)</label>
        <input value={lesson} onChange={(e) => setLesson(e.target.value.trim())} placeholder="phys-u1-l1" dir="ltr"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-small outline-none focus:border-primary" />
        {msg && <p className="text-xs font-bold text-danger">{msg}</p>}
        <div className="flex gap-2">
          <button onClick={() => act("approve_draft")} disabled={busy}
            className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {busy ? "جاري..." : "اعتماد ونشر ✅"}
          </button>
          <button onClick={() => act("delete_draft")} disabled={busy}
            className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger disabled:opacity-50">حذف</button>
        </div>
      </div>
    </li>
  );
}

export default function AdminBankPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // ربط الدروس
  const [meta, setMeta] = useState<{ code: string; label: string; subjects: string[] }[]>([]);
  const [linkTrack, setLinkTrack] = useState("");
  const [linkSubject, setLinkSubject] = useState("");
  const [linkLessons, setLinkLessons] = useState<{ code: string; title: string }[]>([]);
  const [linkQs, setLinkQs] = useState<Suggest[]>([]);
  const [linkTotal, setLinkTotal] = useState(0);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [linkMsg, setLinkMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/admin/bank");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setData(j); setErr(""); }
      else setErr("تعذر التحميل — تأكد أن حسابك platform_admin.");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch("/api/admin/bank/meta").then((r) => r.json()).then((j) => {
      if (j?.ok) setMeta(j.tracks ?? []);
    }).catch(() => {});
  }, []);

  async function loadSuggest(track: string, subject: string) {
    if (!track || !subject) return;
    setLinkMsg("جاري تحليل الأسئلة...");
    try {
      const r = await fetch(`/api/admin/bank/suggest?trackCode=${encodeURIComponent(track)}&subject=${encodeURIComponent(subject)}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setLinkLessons(j.lessons ?? []);
        setLinkQs(j.questions ?? []);
        setLinkTotal(j.unmappedTotal ?? 0);
        const pre: Record<string, string> = {};
        (j.questions ?? []).forEach((q: Suggest) => { if (q.suggestions[0]) pre[q.id] = q.suggestions[0].code; });
        setChosen(pre);
        setLinkMsg("");
      } else setLinkMsg("تعذر التحميل.");
    } catch { setLinkMsg("تعذر الاتصال."); }
  }

  async function confirmLink(id: string) {
    const code = chosen[id];
    if (!code) { setLinkMsg("اختر الدرس أولاً."); return; }
    setBusy(id); setLinkMsg("");
    try {
      const r = await fetch("/api/admin/bank/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, lesson_code: code }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setLinkQs((prev) => prev.filter((q) => q.id !== id));
        setLinkTotal((t) => Math.max(0, t - 1));
        if (j.subjectMismatch) setLinkMsg("تم الربط مع تنبيه: مادة الدرس تختلف عن مادة السؤال — راجعها.");
      } else setLinkMsg("فشل التثبيت: " + (j?.error ?? "خطأ"));
    } catch { setLinkMsg("تعذر الاتصال."); }
    finally { setBusy(null); }
  }

  async function review(id: string, action: "approve" | "reject") {
    if (!confirm(action === "approve" ? "اعتماد ونشر في البنك العام؟" : "رفض هذا السؤال؟")) return;
    setBusy(id);
    try {
      const r = await fetch("/api/admin/bank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) load();
      else setErr("فشلت المراجعة.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(null); }
  }

  if (err) return <div className="mx-auto max-w-md p-8 text-center font-bold text-danger">{err}</div>;
  if (!data) return <div className="p-8 text-center text-slate-400">جاري تحميل البنك المركزي...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">البنك المركزي 🌍</h1>
          <p className="mt-1 text-small text-slate-500">مراجعة مساهمات المعلمين + فجوات التغطية — انشر المحتوى الأصلي والرسمي فقط</p>
        </div>
        <a href="/admin" className="btn-secondary text-small">← الإدارة</a>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["أسئلة منشورة", data.stats.sharedTotal],
          ["بانتظار المراجعة", data.stats.pendingCount],
          ["مواد مغطاة", Object.keys(data.stats.bySubject).length],
          ["دروس بلا أسئلة", data.stats.gapsTotal],
        ].map(([l, v]) => (
          <div key={l as string} className="card p-4 text-center">
            <div className="text-h1 font-extrabold text-primary">{v}</div>
            <div className="mt-1 text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">طابور المراجعة ({data.pending.length})</h2>
        {data.pending.length === 0 ? (
          <p className="text-small text-slate-500">لا يوجد ما ينتظر — كل المساهمات تمت مراجعتها. 🎉</p>
        ) : (
          <ul className="space-y-3">
            {data.pending.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 p-4">
                <div className="text-small font-bold">{p.body}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{p.subject}</span><span>·</span><span>{p.qtype}</span>
                  <span>·</span><span>صعوبة {p.difficulty}</span>
                  <span>·</span><span>من: {p.tenant_name}</span>
                  {p.source && <><span>·</span><span>المصدر: {p.source}</span></>}
                </div>
                {Array.isArray(p.options) && (
                  <div className="mt-2 text-xs text-slate-600">الاختيارات: {p.options.join(" / ")}</div>
                )}
                {p.correct_answer && <div className="mt-1 text-xs font-bold text-success">الصحيحة: {p.correct_answer}</div>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => review(p.id, "approve")} disabled={busy === p.id}
                    className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">اعتماد ونشر ✅</button>
                  <button onClick={() => review(p.id, "reject")} disabled={busy === p.id}
                    className="rounded-lg bg-danger/10 px-4 py-1.5 text-xs font-bold text-danger disabled:opacity-50">رفض</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-bold">ربط الدروس 🔗 (مراجعة بشرية إلزامية)</h2>
          <p className="mt-1 text-xs text-slate-500">
            النظام يقترح — وأنت تثبّت. لا يُعتمد أي ربط تلقائياً. الدليل: الكلمات المشتركة بين السؤال وعنوان الدرس.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={linkTrack} onChange={(e) => { setLinkTrack(e.target.value); setLinkSubject(""); setLinkQs([]); }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <option value="">اختر المسار…</option>
            {meta.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
          <select value={linkSubject} onChange={(e) => { setLinkSubject(e.target.value); loadSuggest(linkTrack, e.target.value); }}
            disabled={!linkTrack} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
            <option value="">اختر المادة…</option>
            {(meta.find((t) => t.code === linkTrack)?.subjects ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {linkMsg && <p className="text-small font-bold text-primary">{linkMsg}</p>}
        {linkSubject && <p className="text-xs text-slate-500">متبقٍ بلا ربط في هذه المادة: <b>{linkTotal}</b></p>}
        <ul className="space-y-3">
          {linkQs.map((q) => (
            <li key={q.id} className="rounded-xl border border-slate-200 p-4">
              <div className="text-small font-bold">{q.body}</div>
              <div className="mt-2 space-y-1.5">
                {q.suggestions.length === 0 && <p className="text-xs text-slate-400">لا يوجد اقتراح — اختر يدوياً من القائمة.</p>}
                {q.suggestions.map((s, i) => (
                  <button key={s.code} onClick={() => setChosen((c) => ({ ...c, [q.id]: s.code }))}
                    className={`block w-full rounded-lg border px-3 py-2 text-right text-xs transition ${chosen[q.id] === s.code ? "border-success bg-success/5 font-bold" : "border-slate-200 hover:border-primary"}`}>
                    <span className="font-bold">[{i + 1}] {s.unit_title} — {s.lesson_title}</span>
                    {s.other_track && <span className="mr-1 rounded bg-amber-100 px-1.5 text-[10px] text-amber-700">مسار آخر: {s.track_label}</span>}
                    <span className="block text-[11px] text-slate-500">الدليل: {s.matched.join("، ") || "—"}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={chosen[q.id] ?? ""} onChange={(e) => setChosen((c) => ({ ...c, [q.id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  <option value="">اختيار يدوي من كل الدروس…</option>
                  {linkLessons.map((l) => <option key={l.code} value={l.code}>{l.title}</option>)}
                </select>
                <button onClick={() => confirmLink(q.id)} disabled={busy === q.id || !chosen[q.id]}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  {busy === q.id ? "جاري..." : "تثبيت الربط ✅"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-bold">مسودات PDF 📄 (اقرأ من الصورة — لا تعتمد النص المستخرج وحده)</h2>
          <p className="mt-1 text-xs text-slate-500">
            كل مسودة تعرض صورة صفحة الامتحان الأصلية بجانب النص المستخرج. صحّح النص والاختيارات من الصورة ثم اعتمد.
          </p>
        </div>
        {((data as any).drafts ?? []).length === 0 ? (
          <p className="text-small text-slate-500">لا مسودات — ارفع PDF عبر سكربت الاستيراد.</p>
        ) : (
          <ul className="space-y-4">
            {((data as any).drafts ?? []).map((d: any) => (
              <DraftCard key={d.id} draft={d} busy={busy === d.id} onDone={load}
                onBusy={(b: boolean) => setBusy(b ? d.id : null)} />
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">فجوات التغطية (دروس بلا أسئلة عامة)</h2>
        <p className="text-xs text-slate-500">وجّه صناعة المحتوى هنا أولاً — هذه الدروس لن يولّد منها شيء.</p>
        {data.gaps.length === 0 ? (
          <p className="text-small text-success">لا فجوات — كل الدروس مغطاة! 🎉</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-y-auto text-small">
            {data.gaps.map((g) => (
              <li key={g.code} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="font-bold">{g.lesson}</span>
                <span className="text-xs text-slate-500">{g.subject} · {g.track}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
