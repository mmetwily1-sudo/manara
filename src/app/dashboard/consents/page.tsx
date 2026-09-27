"use client";

import { useEffect, useState } from "react";

type C = { id: string; student_id: string; title: string; body: string; status: string; decided_at: string | null; created_at: string; users: { full_name: string } | null };

/** موافقات ولي الأمر: طلب موقع برابط + نسخ ومشاركة */
export default function ConsentsPage() {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [list, setList] = useState<C[] | null>(null);
  const [form, setForm] = useState({ student_id: "", title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    try {
      const [rs, rc] = await Promise.all([fetch("/api/students"), fetch("/api/consents")]);
      const js = await rs.json().catch(() => null);
      const jc = await rc.json().catch(() => null);
      if (rs.ok && js?.ok) setStudents((js.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
      if (rc.ok && jc?.ok) setList(jc.consents);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/consents", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setForm({ student_id: "", title: "", body: "" }); load(); setNotice(`تم — رابط الموافقة: ${j.link} 🔗`); }
      else setNotice("فشل الإنشاء.");
    } catch { setNotice("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  function copy(id: string) {
    const link = `${window.location.origin}/c/${id}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(id); setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">موافقات ولي الأمر 📋</h1>
        <p className="mt-1 text-small text-slate-500">طلب موقع برابط — قرار واحد موثق بتاريخه (رحلات/نشاطات/سياسات)</p>
      </header>
      {notice && <div className="card border-primary/20 bg-primary-light/30 p-4 text-small font-bold" dir="auto">{notice}</div>}

      <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
        <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:col-span-2">
          <option value="">اختر الطالب…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120}
          placeholder="عنوان الموافقة (مثال: رحلة ترفيهية — دريم بارك)" className="rounded-xl border border-slate-200 px-4 py-2.5 sm:col-span-2" />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} maxLength={2000}
          placeholder="التفاصيل: الموعد، التكلفة، الإقرار... (اختياري)" className="input w-full sm:col-span-2" dir="auto" />
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري..." : "إنشاء طلب موافقة + رابط"}</button>
      </form>

      {list === null ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا طلبات بعد.</div>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <span className="font-bold">{c.title}</span>
                <span className="mx-2 text-xs text-slate-400">{c.users?.full_name ?? ""}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.status === "approved" ? "bg-success/10 text-success" : c.status === "rejected" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                  {c.status === "approved" ? "موافق ✅" : c.status === "rejected" ? "مرفوض" : "بانتظار ⏳"}
                </span>
              </div>
              {c.status === "pending" && (
                <button onClick={() => copy(c.id)} className="btn-secondary !px-3 !py-1.5 text-xs">
                  {copied === c.id ? "✓ تم النسخ" : "نسخ الرابط 🔗"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
