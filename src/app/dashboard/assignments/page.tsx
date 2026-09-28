"use client";

import { useEffect, useState } from "react";

type Assignment = {
  id: string; group_id: string; group_name: string | null; title: string;
  description: string | null; due_at: string | null; max_score: number;
  submitted: number; graded: number;
};
type Submission = {
  id: string; student_id: string; student_name: string; score: number | null;
  feedback_text: string | null; status: string; submitted_at: string; file_urls: string[];
};

function FileLink({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  async function open(e: React.MouseEvent) {
    e.preventDefault();
    if (url) { window.open(url, "_blank", "noopener"); return; }
    try {
      const r = await fetch(`/api/files/sign?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setUrl(j.url); window.open(j.url, "_blank", "noopener"); }
    } catch {}
  }
  return (
    <a href="#" onClick={open} className="rounded-lg bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary hover:underline">
      📎 {label}
    </a>
  );
}

export default function AssignmentsPage() {
  const [list, setList] = useState<Assignment[] | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ group_id: "", title: "", description: "", due_at: "", max_score: "10", answer_key: "" });
  const [reminding, setReminding] = useState("");

  async function onRemind(id: string) {
    setReminding(id);
    try {
      const r = await fetch(`/api/assignments/${id}/remind`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setOkMsg(`تم تذكير ${j.pending} طالب (وصل ${j.pushed}) 🔔`);
      else setErr("فشل التذكير.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setReminding(""); }
  }
  const [remedialGroup, setRemedialGroup] = useState("");
  const [remedialBusy, setRemedialBusy] = useState(false);

  async function onRemedial() {
    if (!remedialGroup) return;
    setRemedialBusy(true);
    try {
      const r = await fetch("/api/assignments/auto-remedial", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: remedialGroup }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg(j.created ? `خطة علاجية 🩹 لـ: ${(j.at_risk ?? []).join("، ")}` : "لا متعثرين في هذه المجموعة ✅");
        load();
      } else setErr("فشل التوليد.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setRemedialBusy(false); }
  }

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [subs, setSubs] = useState<Record<string, Submission[]>>({});
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});

  async function load() {
    try {
      const r = await fetch("/api/assignments", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.assignments ?? []);
    } catch {}
    try {
      const r = await fetch("/api/groups", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups((j.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setOkMsg("");
    try {
      const r = await fetch("/api/assignments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, max_score: Number(form.max_score) || 10 }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg("تم إنشاء الواجب ✅");
        setForm({ group_id: "", title: "", description: "", due_at: "", max_score: "10", answer_key: "" });
        load();
      } else setErr(j?.message ?? "فشل الإنشاء: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  async function toggle(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (subs[id]) return;
    try {
      const r = await fetch(`/api/assignments/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setSubs((p) => ({ ...p, [id]: j.submissions ?? [] }));
    } catch {}
  }

  async function onGrade(aid: string, sid: string) {
    const g = grades[aid + ":" + sid] ?? { score: "", feedback: "" };
    setErr(""); setOkMsg("");
    try {
      const r = await fetch(`/api/assignments/${aid}/grade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: sid, score: Number(g.score), feedback_text: g.feedback }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setOkMsg("تم التصحيح ✅");
        const rr = await fetch(`/api/assignments/${aid}`, { cache: "no-store" });
        const jj = await rr.json().catch(() => null);
        if (rr.ok && jj?.ok) setSubs((p) => ({ ...p, [aid]: jj.submissions ?? [] }));
        load();
      } else setErr(j?.message ?? "فشل التصحيح: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }

  async function onDelete(id: string) {
    if (!confirm("حذف هذا الواجب وتسليماته؟")) return;
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    if (open === id) setOpen(null);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">الواجبات 📝</h1>
        <p className="mt-1 text-small text-slate-500">أنشئ واجباً لمجموعة — الطالب يصوّر حله — صحّح من هنا.</p>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {okMsg && <div className="card border-success/30 bg-success/5 p-4 text-small font-bold text-success">{okMsg}</div>}

      <div className="card flex flex-wrap items-center gap-2 p-4">
        <span className="text-small font-bold">خطة علاجية تلقائية 🩹</span>
        <select value={remedialGroup} onChange={(e) => setRemedialGroup(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
          <option value="">المجموعة...</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={onRemedial} disabled={remedialBusy || !remedialGroup} className="btn-secondary text-small disabled:opacity-50">
          {remedialBusy ? "جاري..." : "توليد للمتعثرين"}
        </button>
      </div>

      <form onSubmit={onCreate} className="card grid gap-3 p-5 sm:grid-cols-2">
        <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} required
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <option value="">المجموعة…</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
          placeholder="عنوان الواجب (مثال: تمارين الدرس الثالث)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <input value={form.answer_key} onChange={(e) => setForm({ ...form, answer_key: e.target.value })} maxLength={2000}
          placeholder="مفتاح التصحيح الذاتي (اختياري — إجابة نصية تُصحح فوراً عند التطابق)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
          placeholder="تعليمات (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
        <input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })}
          className="rounded-xl border border-slate-200 px-4 py-2.5" />
        <div className="flex items-center gap-2">
          <input value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} inputMode="decimal"
            placeholder="الدرجة العظمى" className="w-32 rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <button className="btn-primary flex-1" disabled={busy}>{busy ? "جاري..." : "إنشاء الواجب"}</button>
        </div>
      </form>

      {list === null ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا واجبات بعد — أنشئ أول واجب من الأعلى.</div>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-small font-bold">{a.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {a.group_name ?? "مجموعة"} · الدرجة {a.max_score}
                    {a.due_at ? ` · التسليم: ${new Date(a.due_at).toLocaleString("ar-EG")}` : " · بلا موعد"}
                    {` · سلّم ${a.submitted} / صُحح ${a.graded}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggle(a.id)} className="rounded-lg bg-primary-light px-3 py-1 text-xs font-bold text-primary">
                    {open === a.id ? "إخفاء التسليمات" : "التسليمات"}
                  </button>
                  <button onClick={() => onRemind(a.id)} disabled={reminding === a.id} className="rounded-lg bg-warning/10 px-3 py-1 text-xs font-bold text-warning disabled:opacity-50">
                    {reminding === a.id ? "..." : "تذكير 🔔"}
                  </button>
                  <button onClick={() => onDelete(a.id)} className="rounded-lg px-3 py-1 text-xs font-bold text-danger hover:bg-danger/10">حذف</button>
                </div>
              </div>
              {open === a.id && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {(subs[a.id] ?? []).length === 0 && <p className="text-xs text-slate-400">لا تسليمات بعد.</p>}
                  {(subs[a.id] ?? []).map((s) => {
                    const k = a.id + ":" + s.student_id;
                    const g = grades[k] ?? { score: s.score?.toString() ?? "", feedback: s.feedback_text ?? "" };
                    return (
                      <div key={s.id} className="rounded-xl bg-slate-50 p-3 text-small">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold">{s.student_name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "graded" ? "bg-success/10 text-success" : s.status === "late" ? "bg-warning/10 text-warning" : "bg-primary-light text-primary"}`}>
                            {s.status === "graded" ? `مصحح ${s.score}/${a.max_score}` : s.status === "late" ? "متأخر" : "بانتظار التصحيح"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">سُلّم: {new Date(s.submitted_at).toLocaleString("ar-EG")} · {s.file_urls.length} ملفات</div>
                        {s.file_urls.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {s.file_urls.map((f: string, i: number) => (
                              <FileLink key={i} path={f} label={`ملف ${i + 1}`} />
                            ))}
                          </div>
                        )}
                        <div className="mt-2 grid gap-2 sm:grid-cols-[100px_1fr_auto]">
                          <input value={g.score} onChange={(e) => setGrades((p) => ({ ...p, [k]: { ...g, score: e.target.value } }))}
                            placeholder="الدرجة" inputMode="decimal" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-small outline-none" />
                          <input value={g.feedback} onChange={(e) => setGrades((p) => ({ ...p, [k]: { ...g, feedback: e.target.value } }))}
                            placeholder="ملاحظة للطالب (اختياري)" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-small outline-none" />
                          <button onClick={() => onGrade(a.id, s.student_id)} className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white">تصحيح ✅</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
