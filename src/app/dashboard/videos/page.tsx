"use client";

import { useEffect, useState } from "react";

type Video = { id: string; title: string; visibility: string; group_ids: string[]; created_at: string };

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", visibility: "group" });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/videos");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setErr(j?.error === "unauth" ? "سجّل دخولك أولاً." : "تعذر تحميل الفيديوهات."); return; }
      setVideos(j.videos);
      setErr("");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/videos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, visibility: form.visibility }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setForm({ title: "", visibility: "group" });
        setShowAdd(false);
        load();
      } else setErr("فشل الإضافة: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  const visible = (videos ?? []).filter((v) =>
    (!filter || v.visibility === filter)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الفيديوهات والكورسات</h1>
          <p className="mt-1 text-small text-slate-500">حصصك المسجلة — وصول متحكم به وعلامة مائية لكل طالب</p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-small">رفع فيديو جديد</button>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {showAdd && (
        <form onSubmit={onAdd} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان الفيديو / الحصة" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <option value="group">لمجموعة محددة</option>
            <option value="free">مجاني للجميع</option>
          </select>
          <button className="btn-primary" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button>
          <p className="text-xs text-slate-400 sm:col-span-2">ملف الفيديو نفسه يُرفع من Bunny Stream — سجّل العنوان هنا أولاً ثم ارفع الملف من لوحة Bunny.</p>
        </form>
      )}

      <div className="card flex flex-wrap gap-2 p-3 text-xs">
        {[
          ["", "الكل"],
          ["free", "مجاني"],
          ["group", "مجموعة"],
        ].map(([v, l]) => (
          <button key={l} onClick={() => setFilter(v)} className={`rounded-full px-3 py-1 font-bold ${filter === v ? "bg-primary-light text-primary" : "bg-slate-50 text-slate-600"}`}>{l}</button>
        ))}
      </div>

      {videos === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الفيديوهات...</div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا توجد فيديوهات بعد — ارفع أول حصة بالزر بالأعلى.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((v) => (
            <li key={v.id} className="card overflow-hidden p-0">
              <div className="flex aspect-video items-center justify-center bg-slate-900 text-4xl text-white/80">▶</div>
              <div className="p-4">
                <div className="text-small font-bold">{v.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className={v.visibility === "free" ? "text-success" : "text-primary"}>{v.visibility === "free" ? "مجاني" : "لمجموعة"}</span>
                  <span>·</span>
                  <span>{new Date(v.created_at).toLocaleDateString("ar-EG")}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <a href={`/watch/${v.id}`} className="btn-primary !px-4 !py-1.5 text-xs">مشاهدة</a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="card bg-primary-light/40 p-4 text-small text-slate-600">
        <b>حماية:</b> كل تشغيل يصدر برابط موقع 15 دقيقة + علامة مائية باسم الطالب فوق الفيديو — يمنع مشاركة الروابط.
      </div>
    </div>
  );
}
