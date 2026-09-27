"use client";

import { useEffect, useState } from "react";

type Rule = { kind: string; label: string; enabled: boolean };
type Entry = { id: string; event: string; channel: string; status: string; student: string; sent_at: string | null; created_at: string };
type Sms = { id: string; phone: string; event: string; status: string; attempts: number; created_at: string };

const CH: Record<string, string> = { whatsapp: "واتساب 💬", webpush: "Push 🔔", sms: "SMS 📱" };
const ST: Record<string, string> = { sent: "وصل ✅", queued: "بالطابور ⏳", failed: "فشل ❌", skipped: "موقوف ⏸️" };

/** المركز الموحد: سجل كل القنوات + طابور SMS + قواعد التفعيل لكل حدث */
export default function NotificationsPage() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [log, setLog] = useState<Entry[] | null>(null);
  const [sms, setSms] = useState<Sms[] | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const [rr, rn] = await Promise.all([fetch("/api/tenant/notify-rules"), fetch("/api/notifications")]);
      const jr = await rr.json().catch(() => null);
      const jn = await rn.json().catch(() => null);
      if (rr.ok && jr?.ok) setRules(jr.events);
      if (rn.ok && jn?.ok) { setLog(jn.log); setSms(jn.sms); }
      else setErr("تعذر تحميل السجل.");
    } catch { setErr("تعذر الاتصال."); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(kind: string, enabled: boolean) {
    try {
      const r = await fetch("/api/tenant/notify-rules", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, enabled }),
      });
      if (r.ok) setRules((prev) => (prev ?? []).map((x) => (x.kind === kind ? { ...x, enabled } : x)));
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">مركز الإشعارات 🔔</h1>
        <p className="mt-1 text-small text-slate-500">كل القنوات في مكان واحد — فعّل أو أوقف أي حدث لسنترك</p>
      </header>
      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">قواعد سنترك ⚙️</h2>
        {!rules ? (
          <div className="text-small text-slate-400">جاري التحميل...</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((x) => (
              <li key={x.kind} className="flex items-center justify-between py-2.5">
                <span className="text-small font-bold">{x.label}</span>
                <button onClick={() => toggle(x.kind, !x.enabled)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${x.enabled ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400"}`}>
                  {x.enabled ? "مفعّل ✅" : "موقوف ⏸️"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">طابور SMS الاحتياطي 📱 <span className="text-xs font-normal text-slate-400">({(sms ?? []).filter((s) => s.status === "queued").length} بالانتظار)</span></h2>
        {(sms ?? []).slice(0, 10).map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
            <span className="font-mono" dir="ltr">{s.phone}</span>
            <span className="text-xs text-slate-500">{s.event} · محاولات {s.attempts}</span>
            <span className="text-xs font-bold">{ST[s.status] ?? s.status}</span>
          </div>
        ))}
        {(sms ?? []).length === 0 && <div className="text-small text-slate-400">الطابور فارغ ✅</div>}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-bold">أحدث الإشعارات 📜</h2>
        {(log ?? []).slice(0, 30).map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
            <div>
              <span className="font-bold">{l.student}</span>
              <span className="mx-2 text-xs text-slate-500">{l.event} · {CH[l.channel] ?? l.channel}</span>
            </div>
            <span className="text-xs font-bold">{ST[l.status] ?? l.status}</span>
          </div>
        ))}
        {(log ?? []).length === 0 && <div className="text-small text-slate-400">لا إشعارات بعد.</div>}
      </section>
    </div>
  );
}
