"use client";

import { useEffect, useState } from "react";

/** مفتاح إشعارات الواتساب التلقائية (غياب/نتائج/مدفوعات) */
export function NotifyToggle() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setEnabled(j.notify_whatsapp !== false);
          setConfigured(!!j.whatsapp_configured);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    setSaving(true);
    try {
      const r = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_whatsapp: !enabled }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setEnabled(!enabled);
    } catch {}
    setSaving(false);
  }

  if (loading) return <p className="text-xs text-slate-400">جاري تحميل حالة الإشعارات...</p>;

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-small font-bold">إشعارات واتساب التلقائية 💬</div>
        <p className="mt-0.5 text-xs text-slate-500">
          غياب الحصة • نتيجة الامتحان • إيصال الدفع — تُرسل لرقم الطالب فوراً.
        </p>
        {!configured && (
          <p className="mt-1 text-xs font-semibold text-amber-600">
            خدمة الإرسال غير مربوطة بعد — تُسجَّل الإشعارات في السجل لحين ربط مفاتيح واتساب.
          </p>
        )}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        aria-label="تفعيل إشعارات الواتساب"
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-success" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "right-1" : "left-1"}`}
        />
      </button>
    </div>
  );
}
