"use client";

import { useEffect, useState } from "react";

type Vehicle = { id: string; plate: string; capacity: number; driver: string };
type Route = { id: string; name: string; stops: string; fee: number };

/** المواصلات: عربيات + خطوط سير + اشتراك شهري بفاتورة */
export default function TransportPage() {
  const [isTeacher, setIsTeacher] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [vform, setVform] = useState({ plate: "", capacity: "", driver: "" });
  const [rform, setRform] = useState({ name: "", stops: "", fee: "", vehicle_id: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/transport", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setIsTeacher(!!j.isTeacher); setVehicles(j.vehicles ?? []); setRoutes(j.routes ?? []);
        setMine(j.mine ?? []); setCounts(j.counts ?? {});
      }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function post(action: string, payload: any, reset: () => void) {
    const r = await fetch("/api/transport", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (r.ok) { reset(); load(); }
  }

  async function subscribe(route_id: string, fee: number) {
    if (!confirm(fee > 0 ? `الاشتراك الشهري بـ${fee} ج؟ ستضاف فاتورة.` : "تأكيد الاشتراك؟")) return;
    const r = await fetch("/api/transport", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", route_id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg("تم اشتراكك ✅"); load(); }
    else setMsg(j?.error === "already" ? "مشترك هذا الشهر." : "فشل الاشتراك.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-h1">المواصلات 🚌</h1>
        <p className="mt-1 text-small text-slate-500">خطوط السير والاشتراك الشهري</p>
      </header>
      {msg && <div className="card p-3 text-small font-bold text-primary">{msg}</div>}
      {isTeacher && (
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">العربيات</h2>
          <form onSubmit={(e) => { e.preventDefault(); post("vehicle", { plate: vform.plate, capacity: Number(vform.capacity || 0), driver: vform.driver }, () => setVform({ plate: "", capacity: "", driver: "" })); }}
            className="grid gap-2 sm:grid-cols-4">
            <input value={vform.plate} onChange={(e) => setVform({ ...vform, plate: e.target.value })} placeholder="اللوحة" maxLength={20}
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" dir="ltr" />
            <input value={vform.capacity} onChange={(e) => setVform({ ...vform, capacity: e.target.value })} placeholder="السعة" inputMode="numeric" dir="ltr"
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <input value={vform.driver} onChange={(e) => setVform({ ...vform, driver: e.target.value })} placeholder="السائق" maxLength={80}
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <button className="btn-primary !py-2 text-small">إضافة عربية</button>
          </form>
          {vehicles.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-small">
              {vehicles.map((v) => <li key={v.id} className="rounded-full bg-slate-100 px-4 py-1.5" dir="ltr">{v.plate} · {v.capacity} · <span dir="auto">{v.driver}</span></li>)}
            </ul>
          )}
        </section>
      )}
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">خطوط السير</h2>
        {isTeacher && (
          <form onSubmit={(e) => { e.preventDefault(); post("route", { name: rform.name, stops: rform.stops, fee: Number(rform.fee || 0), vehicle_id: rform.vehicle_id || undefined }, () => setRform({ name: "", stops: "", fee: "", vehicle_id: "" })); }}
            className="grid gap-2 sm:grid-cols-5">
            <input value={rform.name} onChange={(e) => setRform({ ...rform, name: e.target.value })} placeholder="اسم الخط" required maxLength={120}
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <input value={rform.stops} onChange={(e) => setRform({ ...rform, stops: e.target.value })} placeholder="المحطات" maxLength={500}
              className="rounded-xl border border-slate-200 px-3 py-2 text-small sm:col-span-2" />
            <input value={rform.fee} onChange={(e) => setRform({ ...rform, fee: e.target.value })} placeholder="الاشتراك" inputMode="decimal" dir="ltr"
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <button className="btn-primary !py-2 text-small">إضافة خط</button>
          </form>
        )}
        <ul className="space-y-2">
          {routes.map((t) => (
            <li key={t.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><b>{t.name}</b> — {t.fee > 0 ? `${t.fee} ج/شهر` : "مجاناً"}
                  {isTeacher && <span className="text-xs text-slate-400"> · {counts[t.id] ?? 0} مشترك</span>}</span>
                {!isTeacher && (mine.includes(t.id)
                  ? <span className="text-xs font-bold text-success">مشترك ✅</span>
                  : <button onClick={() => subscribe(t.id, t.fee)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">اشترك</button>)}
              </div>
              {t.stops && <div dir="auto" className="mt-1 text-xs text-slate-500">{t.stops}</div>}
            </li>
          ))}
          {routes.length === 0 && <li className="text-xs text-slate-400">لا خطوط بعد.</li>}
        </ul>
      </section>
    </div>
  );
}
