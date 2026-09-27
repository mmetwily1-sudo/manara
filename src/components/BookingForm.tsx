"use client";

import { useState } from "react";

/** نموذج حجز تجريبي عام (صفحة المعلم) — بلا دخول، ضد مكرر المعلق */
export default function BookingForm({ teacherId, groups }: { teacherId: string; groups: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gid, setGid] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacherId, name, phone, group_id: gid || undefined }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDone(true);
      else setErr(j?.error === "already_pending" ? "لديك حجز معلق بالفعل — سنتواصل معك قريباً ⏳" : "تعذر الحجز — حاول لاحقاً.");
    } catch { setErr("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  if (done) {
    return <div className="rounded-xl bg-success/10 p-4 text-center font-bold text-success">تم استلام طلبك 🎉 سنتواصل معك واتساب للتأكيد.</div>;
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-slate-50 p-4">
      <div className="font-bold">احجز حصتك التجريبية 🎟️</div>
      <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="اسم الطالب" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="رقم واتساب (01xxxxxxxxx)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" dir="ltr" />
      {groups.length > 0 && (
        <select value={gid} onChange={(e) => setGid(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <option value="">أي مجموعة مناسبة</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      {err && <div className="text-xs font-bold text-danger">{err}</div>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "جاري..." : "تأكيد الحجز"}</button>
    </form>
  );
}
