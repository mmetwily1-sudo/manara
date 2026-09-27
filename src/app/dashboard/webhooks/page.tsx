"use client";

import { useEffect, useState } from "react";

type H = { id: string; url: string; events: string[]; is_active: boolean; created_at: string };
type D = { event: string; status_code: number | null; ok: boolean; created_at: string; webhook_id: string };

/** الويبهوكات الصادرة: ربط الأنظمة الخارجية + سجل التسليم (مالك) */
export default function WebhooksPage() {
  const [hooks, setHooks] = useState<H[] | null>(null);
  const [dlv, setDlv] = useState<D[]>([]);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [form, setForm] = useState({ url: "", events: ["payment_received"] as string[], secret: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/webhooks");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setHooks(j.hooks); setDlv(j.deliveries); setAllowed(j.allowed ?? []); }
      else setErr("تعذر التحميل — للمالك فقط.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  function toggleEv(e: string) {
    setForm((f) => ({ ...f, events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e] }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/webhooks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setForm({ url: "", events: ["payment_received"], secret: "" }); load(); }
      else setErr("فشل الإنشاء: " + (j?.error ?? ""));
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function toggle(id: string, is_active: boolean) {
    try {
      const r = await fetch("/api/webhooks", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active }),
      });
      if (r.ok) load();
    } catch {}
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الويبهوك نهائياً؟")) return;
    try {
      const r = await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
      if (r.ok) load();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">الويبهوكات 🔗</h1>
        <p className="mt-1 text-small text-slate-500">ادفع الأحداث لأنظمتك (CRM/شيتات/سيرفر) لحظة حدوثها — بتوقيع HMAC</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <form onSubmit={create} className="card space-y-3 p-5">
        <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required dir="ltr"
          placeholder="https://your-server.com/hook" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-small" />
        <div className="flex flex-wrap gap-2">
          {allowed.map((e) => (
            <button key={e} type="button" onClick={() => toggleEv(e)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${form.events.includes(e) ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
              {e}
            </button>
          ))}
        </div>
        <input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} maxLength={200} dir="ltr"
          placeholder="سر التوقيع (اختياري — يُرسل X-Manara-Signature)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-small" />
        <button className="btn-primary" disabled={busy}>{busy ? "جاري..." : "إضافة الويبهوك"}</button>
      </form>

      <ul className="space-y-2">
        {(hooks ?? []).map((h) => (
          <li key={h.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <div className="font-mono text-small font-bold" dir="ltr">{h.url}</div>
              <div className="mt-1 text-xs text-slate-400">{h.events.join(" · ")}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggle(h.id, !h.is_active)}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${h.is_active ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400"}`}>
                {h.is_active ? "نشط ✅" : "موقوف ⏸️"}
              </button>
              <button onClick={() => remove(h.id)} className="rounded-lg bg-danger/10 px-3 py-1 text-xs font-bold text-danger">حذف</button>
            </div>
          </li>
        ))}
        {hooks !== null && hooks.length === 0 && <div className="card p-8 text-center text-small text-slate-500">لا ويبهوكات بعد.</div>}
      </ul>

      {dlv.length > 0 && (
        <section className="card space-y-1 p-5">
          <h2 className="font-bold">آخر التسليمات 📜</h2>
          {dlv.slice(0, 15).map((d, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
              <span>{d.event}</span>
              <span className={`font-bold ${d.ok ? "text-success" : "text-danger"}`}>{d.ok ? `✓ ${d.status_code ?? ""}` : `✗ ${d.status_code ?? "بلا رد"}`}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
