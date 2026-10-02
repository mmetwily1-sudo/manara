"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { GoogleCaps } from "@/lib/google";

/**
 * ربط جوجل الموحد: Calendar + Sheets + Gmail بضغطة واحدة.
 * يعيد التفويض عند نقص صلاحية — لا نخزن توكنات أبداً.
 */
export function GoogleConnect() {
  const [caps, setCaps] = useState<GoogleCaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showMail, setShowMail] = useState(false);
  const [mail, setMail] = useState({ to: "", subject: "", text: "" });
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState("");

  async function sendMail(e: React.FormEvent) {
    e.preventDefault();
    setMailBusy(true); setMailMsg("");
    try {
      const r = await fetch("/api/integrations/google/gmail-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mail),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMailMsg("تم الإرسال من بريدك ✅"); setMail({ to: "", subject: "", text: "" }); }
      else setMailMsg(j?.message ?? "تعذر الإرسال");
    } catch { setMailMsg("تعذر الاتصال"); }
    setMailBusy(false);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/integrations/google/status");
      const j = await r.json().catch(() => null);
      setCaps(j?.caps ?? { calendar: false, sheets: false, gmail: false });
    } catch { setCaps({ calendar: false, sheets: false, gmail: false }); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("google") === "connected") {
        setMsg("تم ربط حساب جوجل ✅ — جاري التحقق من الصلاحيات...");
        const t = setTimeout(load, 2500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  async function connect() {
    setBusy(true); setMsg("");
    try {
      const { GOOGLE_SCOPES } = await import("@/lib/google");
      const sb = createClient();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: GOOGLE_SCOPES,
          redirectTo: `${window.location.origin}/dashboard/settings?google=connected`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) setMsg("تعذر بدء الربط — حاول تاني");
    } catch { setMsg("تعذر الاتصال بالخادم"); }
    setBusy(false);
  }

  const all = caps?.calendar && caps?.sheets && caps?.gmail;
  const badge = (on: boolean, label: string) => (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400"}`}>
      {on ? "✅" : "○"} {label}
    </span>
  );

  return (
    <div>
      <h2 className="font-bold">تكاملات جوجل 🟢</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        اربط حساب جوجل مرة واحدة: مزامنة الحصص مع التقويم، تصدير الكشوف لشيتات جوجل،
        وإرسال الإشعارات عبر جيميل — كلها مجانية وبحسابك الحالي.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {loading ? <span className="text-xs text-slate-400">جاري الفحص...</span> :
          <>{badge(!!caps?.calendar, "التقويم")} {badge(!!caps?.sheets, "الشيتات")} {badge(!!caps?.gmail, "جيميل")}</>}
      </div>
      {msg && <p className="mt-2 text-xs font-bold text-primary">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={connect} disabled={busy} className="btn-primary !px-5 !py-2 text-small disabled:opacity-50">
          {busy ? "جاري التحويل لجوجل..." : all ? "🔄 إعادة الربط / تحديث الصلاحيات" : "اربط حساب جوجل"}
        </button>
        <a href="/api/integrations/google/test-mail" className="btn-secondary !px-5 !py-2 text-small">
          ✉️ ابعت رسالة اختبار لبريدي
        </a>
        {caps?.gmail && (
          <button onClick={() => setShowMail((v) => !v)} className="btn-secondary !px-5 !py-2 text-small">
            ✍️ إرسال بريد من حسابي
          </button>
        )}
      </div>
      {showMail && caps?.gmail && (
        <form onSubmit={sendMail} className="mt-3 space-y-2 rounded-xl border border-slate-200 p-4">
          <input value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} required type="email"
            placeholder="إلى: parent@example.com" dir="ltr"
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 text-left text-small outline-none focus:border-primary" />
          <input value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} required maxLength={120}
            placeholder="الموضوع"
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 text-small outline-none focus:border-primary" />
          <textarea value={mail.text} onChange={(e) => setMail({ ...mail, text: e.target.value })} required maxLength={2000} rows={3}
            placeholder="نص الرسالة..."
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-2 text-small outline-none focus:border-primary" />
          {mailMsg && <p className="text-xs font-bold text-primary">{mailMsg}</p>}
          <button disabled={mailBusy} className="btn-primary !px-5 !py-2 text-small disabled:opacity-50">
            {mailBusy ? "جاري الإرسال..." : "إرسال"}
          </button>
        </form>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        الأمان: لا نخزن أي توكنات — الصلاحيات على حسابك أنت، وتقدر تسحبها بأي وقت من
        myaccount.google.com ← الأمان ← الوصول الخارجي.
      </p>
    </div>
  );
}
