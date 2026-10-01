"use client";

import { useEffect, useState } from "react";
import { SkeletonList, EmptyState } from "@/components/Loading";

type Note = { id: string; title: string; subject: string; lesson: string; content: string; visibility: string; custom: boolean; updated_at: string };

/** إدارة المذكرات: إنشاء/تعديل/حذف + فلترة حسب المادة/الدرس */
export default function NotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [filter, setFilter] = useState({ subject: "", lesson: "", visibility: "all" });
  const [form, setForm] = useState({ title: "", subject: "", lesson: "", content: "", visibility: "group", group_id: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (filter.subject) params.set("subject", filter.subject);
      if (filter.lesson) params.set("lesson", filter.lesson);
      if (filter.visibility !== "all") params.set("visibility", filter.visibility);
      const r = await fetch(`/api/notes?${params.toString()}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setNotes(j.notes);
    } catch {}
  }

  useEffect(() => { load(); }, [filter]);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const isEdit = !!editing;
      const r = await fetch("/api/notes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing, ...form }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setForm({ title: "", subject: "", lesson: "", content: "", visibility: "group", group_id: "" }); setEditing(null); load(); }
      else setErr("فشل الحفظ");
    } catch { setErr("تعذر الاتصال"); }
    finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("حذف المذكرة نهائياً؟")) return;
    try {
      const r = await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      if (r.ok) load();
    } catch {}
  }

  function edit(n: Note) {
    setEditing(n.id);
    setForm({ title: n.title, subject: n.subject, lesson: n.lesson, content: n.content, visibility: n.visibility, group_id: "" });
  }

  async function fetchGroups() {
    try {
      const r = await fetch("/api/groups");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setGroups(j.groups);
    } catch {}
  }

  useEffect(() => { fetchGroups(); }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">إدارة المذكرات 📝</h1>
        <p className="mt-1 text-small text-slate-500">أنشئ ونظِّم مذكراتك — عامة، مجموعة، أو خاصة</p>
      </header>

      {/* الفلاتر */}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input value={filter.subject} onChange={e => setFilter({ ...filter, subject: e.target.value })} placeholder="مادة..." className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <input value={filter.lesson} onChange={e => setFilter({ ...filter, lesson: e.target.value })} placeholder="درس..." className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <select value={filter.visibility} onChange={e => setFilter({ ...filter, visibility: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="all">كل الرؤيات</option>
            <option value="public">🌐 عام</option>
            <option value="group">👥 مجموعة</option>
            <option value="private">🔒 خاص</option>
          </select>
        </div>
      </section>

      {/* نموذج إنشاء/تعديل */}
      <form onSubmit={e => { e.preventDefault(); save(); }} className="card space-y-3 p-5">
        <h2 className="font-bold">{editing ? "تعديل المذكرة ✏️" : "مذكرة جديدة ➕"}</h2>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={150}
          placeholder="العنوان..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required maxLength={80}
          placeholder="المادة (مثال: رياضيات)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <input value={form.lesson} onChange={e => setForm({ ...form, lesson: e.target.value })} maxLength={120}
          placeholder="الدرس (اختياري)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required rows={3} maxLength={5000}
          placeholder="محتوى المذكرة..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          <option value="public">🌐 عام — يراها الجميع</option>
          <option value="group">👥 مجموعة — مجموعة محددة</option>
          <option value="private">🔒 خاص — أنت فقط</option>
        </select>
        {form.visibility === "group" && groups.length > 0 && (
          <select value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
            <option value="">اختر المجموعة...</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <button className="btn-primary !py-2" disabled={busy}>{busy ? "جاري الحفظ..." : editing ? "تحديث" : "حفظ"}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm({ title: "", subject: "", lesson: "", content: "", visibility: "group", group_id: "" }); }} className="btn-secondary !py-2">إلغاء</button>}
        </div>
        {err && <div className="text-sm text-danger">{err}</div>}
        {notice && <div className="text-sm text-success">{notice}</div>}
      </form>

      {/* قائمة المذكرات */}
      <section className="card p-4">
        <ul className="space-y-3">
          {notes === null ? <SkeletonList rows={4} /> :
            notes.length === 0 ? <EmptyState icon="📝" title="لا مذكرات بعد" desc="أضف أول مذكرة من النموذج بالأعلى." /> :
            notes.map(n => (
              <li key={n.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base" dir="auto">{n.title}</div>
                    {n.content && <div className="mt-1 text-sm text-slate-600 line-clamp-2" dir="auto">{n.content}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="rounded-full bg-success/10 px-3 py-1 font-bold text-success">مادة: {n.subject}</span>
                    {n.lesson && <span className="rounded-full bg-primary-light px-3 py-1 font-bold text-primary">درس: {n.lesson}</span>}
                    <span className={`rounded-full px-3 py-1 font-bold ${n.visibility === "public" ? "bg-success/10 text-success" : n.visibility === "group" ? "bg-primary-light text-primary" : "bg-slate-100 text-slate-500"}`}>
                      {n.visibility === "public" ? "🌐 عام" : n.visibility === "group" ? "👥 مجموعة" : "🔒 خاص"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400" dir="ltr">{new Date(n.updated_at).toLocaleString("ar-EG")}</span>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400">محدث: {new Date(n.updated_at).toLocaleString("ar-EG")}</span>
                    <button onClick={() => edit(n)} className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white">تعديل</button>
                    <button onClick={() => del(n.id)} className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger">حذف</button>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}