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

/** ثيم صفحة المعلم العامة (default/dark/minimal) */
export function ThemeForm() {
  const [theme, setTheme] = useState("default");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  async function save(v: string) {
    setTheme(v); setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/tenant/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: v }),
      });
      setMsg(r.ok ? "تم ✅" : "فشل الحفظ.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setSaving(false); }
  }
  return (
    <div>
      <div className="text-small font-bold">شكل صفحتك العامة 🎨</div>
      <div className="mt-2 flex gap-2">
        {[["default", "افتراضي"], ["dark", "داكن 🌙"], ["minimal", "بسيط"]].map(([v, l]) => (
          <button key={v} onClick={() => save(v)} disabled={saving}
            className={`rounded-xl border-2 px-4 py-2 text-small font-bold transition ${theme === v ? "border-primary bg-primary-light text-primary" : "border-slate-200 text-slate-500 hover:border-primary"}`}>
            {l}
          </button>
        ))}
      </div>
      {msg && <span className="mt-1 block text-xs font-bold text-primary">{msg}</span>}
    </div>
  );
}

/** مفتاح التفريغ المرئي (Gemini مجاني) — يحوّل المسح لاستخراج دقيق */
export function VisionKeyForm() {
  const [key, setKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [live, setLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/tenant/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) { setHasKey(!!j.has_vision_key); setLive(!!j.vision_live); }
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vision_key: key }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setHasKey(!!key); setKey("");
        const s = await (await fetch("/api/tenant/settings")).json().catch(() => null);
        setLive(!!s?.vision_live);
        setMsg(key ? "تم الحفظ والتفعيل ✅" : "تم المسح.");
      } else setMsg("مفتاح غير صالح.");
    } catch { setMsg("تعذر الاتصال."); }
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <div className="text-small font-bold">التفريغ المرئي الدقيق 👁️ {live ? <span className="text-success">· مفعّل</span> : hasKey ? <span className="text-warning">· محفوظ</span> : null}</div>
        <p className="mt-0.5 text-xs text-slate-500">
          الصق مفتاح Gemini المجاني (دقيقتان من <span className="font-mono" dir="ltr">aistudio.google.com</span>) فيحوّل المسح نصوصاً دقيقة تلقائياً. بدونه يعمل OCR الأساسي + النسخ اليدوي.
        </p>
      </div>
      <input value={key} onChange={(e) => setKey(e.target.value)} dir="ltr" type="password" autoComplete="off"
        placeholder={hasKey ? "•••• محفوظ — الصق جديداً للاستبدال أو أفرغ واحفظ للمسح" : "الصق المفتاح هنا"}
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-left outline-none focus:border-primary" />
      <button className="btn-primary !py-2 text-small" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</button>
      {msg && <span className="text-xs font-bold text-primary">{msg}</span>}
    </form>
  );
}

/** أرقام استقبال الدفع (تظهر للطالب في صفحة الدفع) */
export function PayNumbersForm() {
  const [nums, setNums] = useState({ instapay: "", wallet: "", fawry: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.pay_numbers) setNums({ instapay: j.pay_numbers.instapay ?? "", wallet: j.pay_numbers.wallet ?? "", fawry: j.pay_numbers.fawry ?? "" });
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const r = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay_numbers: nums }),
      });
      if (r.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <div className="text-small font-bold">أرقام استقبال الدفع 💳</div>
        <p className="mt-0.5 text-xs text-slate-500">تظهر للطالب في صفحة الدفع — اترك الفارغ فارغاً.</p>
      </div>
      {([["instapay", "انستاباي (عنوان الدفع)"], ["wallet", "محفظة (رقم الموبايل)"], ["fawry", "فوري (رقم التاجر)"]] as const).map(([k, label]) => (
        <div key={k}>
          <label className="mb-1 block text-xs font-bold text-slate-600">{label}</label>
          <input value={nums[k]} onChange={(e) => setNums({ ...nums, [k]: e.target.value })} dir="ltr"
            placeholder="—" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-left outline-none focus:border-primary" />
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button className="btn-primary !py-2 text-small" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ الأرقام"}</button>
        {saved && <span className="text-xs font-bold text-success">✓ تم الحفظ</span>}
      </div>
    </form>
  );
}
