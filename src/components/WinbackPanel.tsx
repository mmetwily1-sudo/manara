"use client";

import { useEffect, useState } from "react";
import { waTo } from "@/lib/wa";

type Cand = {
  id: string; name: string; slug: string; expired_since: string;
  owner_phone: string | null; users: number; payments: number; exams: number; questions: number;
};

/** عدة الاسترداد: تجارب منتهية نشطة + رسالة واتساب شخصية + تمديد عرض العودة */
export default function WinbackPanel() {
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/winback");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setCands(j.candidates);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function extend(id: string) {
    if (!confirm("تمديد تجربة هذا السنتر 7 أيام (عرض العودة)؟")) return;
    setBusy(id);
    try {
      const r = await fetch("/api/admin/winback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, days: 7 }),
      });
      if (r.ok) load();
    } catch {}
    finally { setBusy(null); }
  }

  if (cands === null || cands.length === 0) return null;

  return (
    <section className="card space-y-3 border-warning/30 bg-warning/5 p-5">
      <h2 className="font-bold text-warning">🎯 استرداد التجارب المنتهية ({cands.length}) — اتصل بهم اليوم</h2>
      <ul className="space-y-2">
        {cands.map((c) => {
          const msg = `السلام عليكم 👋 معك فريق منارة — لاحظنا أن تجربتكم انتهت بعد ما جربتم المنصة. حابين نمدد لكم التجربة 7 أيام مجاناً + خصم خاص على أول اشتراك لو فعلتم خلال 48 ساعة. تحب أشرح لك أي ميزة؟ (${c.name})`;
          const link = waTo(c.owner_phone, msg);
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-small">
              <div>
                <span className="font-bold">{c.name}</span>
                <span className="mx-2 text-xs text-slate-400">منتهية منذ {new Date(c.expired_since).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
                <span className="text-xs text-slate-500">· {c.users} مستخدم · {c.payments} مدفوعات · {c.exams} امتحانات · {c.questions} أسئلة</span>
              </div>
              <div className="flex gap-2">
                {link && <a href={link} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white">واتساب 💬</a>}
                <button onClick={() => extend(c.id)} disabled={busy === c.id}
                  className="rounded-lg bg-primary-light px-4 py-1.5 text-xs font-bold text-primary disabled:opacity-50">
                  {busy === c.id ? "..." : "تمديد 7 أيام 🎁"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
