"use client";

import { useEffect, useState, useCallback } from "react";

type Thread = {
  id: string;
  group: string;
  locked: boolean;
  pinned: boolean;
  category: string;
  replies: number;
  first: { body: string; sender: string } | null;
};
type Msg = { id: string; body: string; sender: string; mine: boolean; created_at: string };

/** منتدى المناقشات المحسن: فئات، بحث، تثبيت، قفل، بحث، تقويم */
export default function ForumPage() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [locked, setLocked] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ title: "", body: "", category: "general" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(1),
        category: "all",
        search: "",
      });
      const r = await fetch(`/api/forum?${params.toString()}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setThreads(j.threads); setIsTeacher(j.isTeacher); }
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = useCallback(async (id: string) => {
    setOpenId(id); setMsgs([]);
    try {
      const r = await fetch(`/api/forum/${id}`);
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsgs(j.messages); setLocked(j.locked); setPinned(j.pinned); }
    } catch {}
  }, []);

  const create = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/forum", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, body: form.body, category: form.category }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setForm({ title: "", body: "", category: "general" }); load(); }
      else setNotice("فشل النشر.");
    } catch { setNotice("تعذر الاتصال."); }
    finally { setBusy(false); }
  }, [form, load]);

  const sendReply = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openId || !reply.trim()) return;
    try {
      const r = await fetch(`/api/forum/${openId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }),
      });
      if (r.ok) { setReply(""); open(openId); load(); }
    } catch {}
  }, [openId, reply, load]);

  const mod = useCallback(async (action: string, message_id?: string) => {
    if (!openId) return;
    try {
      const r = await fetch(`/api/forum/${openId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message_id }),
      });
      if (r.ok) { open(openId); load(); }
    } catch {}
  }, [openId, load]);

  function renderThreadItem(t: Thread) {
    return (
      <li key={t.id}>
        <button onClick={() => open(t.id)}
          className={`w-full rounded-xl border p-4 text-right transition ${openId === t.id ? "border-primary bg-primary-light/40" : "border-slate-200/70 bg-surface"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-small font-bold" dir="auto">{t.first?.body.split("\n")[0].replace(/\*\*/g, "") ?? ""} {t.pinned && "📌"} {t.locked && "🔒"}</div>
            <div className="mt-1 text-xs text-slate-400">{t.group} · {t.category} · {t.replies} رد</div>
          </div>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-slate-400">{t.category}</span>
        </div>
      </button>
    </li>
  );
  }

  function renderThreadList() {
    if (threads === null) return <div className="card p-6 text-center text-slate-400">جاري التحميل...</div>;
    if (threads.length === 0) return <div className="card p-6 text-center text-small text-slate-500">لا مواضيع بعد — ابدأ الأول.</div>;
    return threads.map((t) => renderThreadItem(t));
  }

  function renderMessages() {
    if (msgs === null) return <div className="card p-6 text-center text-slate-400">جاري التحميل...</div>;
    if (msgs.length === 0) return <div className="card p-6 text-center text-small text-slate-500">لا ردود بعد.</div>;
    return (
      <div className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">الردود ({msgs.length})</h2>
          <div className="flex items-center gap-2">
            {locked && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">🔒 مغلق</span>}
            {pinned && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">📌 مثبت</span>}
            <div className="text-xs text-slate-400">{msgs.length} رسالة</div>
            {isTeacher && (
              <div className="flex gap-1 ml-auto">
                <button onClick={() => mod(locked ? "unlock" : "lock")} className="rounded-lg px-3 py-1 text-xs font-bold text-danger bg-danger/10">{locked ? "فتح 🔓" : "قفل 🔒"}</button>
                <button onClick={() => mod(pinned ? "unpin" : "pin")} className="rounded-lg px-3 py-1 text-xs font-bold text-primary">{pinned ? "إلغاء التثبيت" : "تثبيت 📌"}</button>
              </div>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {msgs.map((m) => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-small ${m.mine ? "bg-primary-light/60" : "bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-slate-400">{m.sender}{m.mine ? " (أنت)" : ""}</div>
                    <div dir="auto">{m.body}</div>
                  </div>
                  {isTeacher && !m.mine && (
                    <button onClick={() => mod("delete_msg", m.id)} className="mt-1 text-[11px] text-danger">حذف 🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {(!locked || isTeacher) && (
            <form onSubmit={sendReply} className="flex gap-2 mt-4">
              <input value={reply} onChange={e => setReply(e.target.value)} maxLength={2000}
                placeholder="اكتب ردك..." className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
              <button className="btn-primary !px-4 !py-2 text-xs">إرسال</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">منتدى المناقشات 💬</h1>
        <p className="mt-1 text-small text-slate-500">اسأل وناقش — بإشراف المعلمين</p>
      </header>

      {/* الفلاتر */}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
            <option value="all">كل الفئات</option>
            <option value="general">عام 💬</option>
            <option value="help">مساعدة ❓</option>
            <option value="study">دراسة 📚</option>
            <option value="exam">امتحانات 📝</option>
            <option value="announcement">إعلانات 📢</option>
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <button onClick={() => { setPage(1); }} className="btn-secondary text-small">بحث 🔍</button>
        </div>
        {notice && <div className="text-xs font-bold text-primary">{notice}</div>}
      </section>

      {/* إنشاء موضوع */}
      <form onSubmit={create} className="card space-y-2 p-5">
        <h2 className="font-bold">موضوع جديد ✏️</h2>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={150}
          placeholder="عنوان الموضوع..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          <option value="general">عام 💬</option>
          <option value="help">مساعدة ❓</option>
          <option value="study">دراسة 📚</option>
          <option value="exam">امتحانات 📝</option>
          <option value="announcement">إعلانات 📢</option>
        </select>
        <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required rows={2} maxLength={2000}
          placeholder="نص المشاركة..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
        <button className="btn-primary !py-2 text-small" disabled={busy}>{busy ? "جاري..." : "نشر الموضوع"}</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2 lg:col-span-1">
          {renderThreadList()}
        </ul>

        <div className="lg:col-span-1">
          {openId ? renderMessages() : <div className="card p-6 text-center text-slate-400">اختر موضوعاً لعرض الردود</div>}
        </div>
      </div>
    </div>
  );
}