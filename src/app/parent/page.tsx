"use client";

import { useEffect, useState } from "react";
import { Onboarding } from "@/components/Onboarding";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";
import { PushAutoPrompt } from "@/components/PushAutoPrompt";
import { NotificationsInbox } from "@/components/NotificationsInbox";
import { ParentOnboarding } from "@/components/ParentOnboarding";

type Data = {
  branding: { name: string; logo_url: string | null; primary_color: string };
  student: { name: string; phone: string | null };
  telegram?: { on: boolean; linked?: boolean; url?: string | null };
  attendance: { present: number; absent: number; total: number };
  grades: { exam: string; score: number; total: number | null; at: string }[];
  dues: { id: string; period: string; amount: number; paid: number; due: number; status: string; receipt: number | null }[];
  online_payment: { enabled: boolean };
};

type Lang = "ar" | "en";

const STR: Record<Lang, Record<string, string>> = {
  ar: {
    loading: "جاري التحميل...", portal: "بوابة ولي الأمر", follow: "متابعة ابنك", live: "لحظة بلحظة",
    attendance: "الحضور الشهري 📊", present: "حاضر", absent: "غائب", total: "إجمالي",
    grades: "الدرجات 📝", noGrades: "لا درجات مسجلة بعد.", dues: "المستحقات 💰", noDues: "لا متأخرات ✅",
    pay: "ادفع", paying: "جاري...", settings: "إعدادات 🔧", ePay: "الدفع الإلكتروني",
    on: "مفعل ✅", off: "غير مفعل — تواصل مع الإدارة", egp: "ج",
  },
  en: {
    loading: "Loading...", portal: "Parent Portal", follow: "Following", live: "live",
    attendance: "Monthly Attendance 📊", present: "Present", absent: "Absent", total: "Total",
    grades: "Grades 📝", noGrades: "No grades yet.", dues: "Dues 💰", noDues: "All clear ✅",
    pay: "Pay", paying: "Processing...", settings: "Settings 🔧", ePay: "Online payment",
    on: "Enabled ✅", off: "Disabled — contact admin", egp: "EGP",
  },
};

export default function ParentPortal() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [lang, setLang] = useState<Lang>("ar");
  const t = STR[lang];

  async function load() {
    try {
      const r = await fetch("/api/parent/portal", { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setData(j);
      else setErr(j?.error || t.loading);
    } catch { setErr(t.loading); }
  }

  async function pay(invoiceId: string, method: string = payMethod) {
    try {
      const r = await fetch("/api/parent/pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, method }),
        credentials: "include",
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) window.location.href = j.iframe_url;
      else alert(j?.error ?? t.loading);
    } catch { alert(t.loading); }
  }

  const [payMethod, setPayMethod] = useState("card");
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    try {
      if (!localStorage.getItem("manara_parent_onboarded")) setOnboarded(false);
    } catch { setOnboarded(false); }
  }, []);

  async function checkTelegramLinked(): Promise<boolean> {
    try {
      const r = await fetch("/api/parent/portal", { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setData(j);
        return !!j.telegram?.linked;
      }
    } catch {}
    return false;
  }
  const [payAll, setPayAll] = useState<{ period: string; url?: string; error?: string }[] | null>(null);
  const [payingAll, setPayingAll] = useState(false);

  /** الدفع الموحد: ملخص + طريقة واحدة + روابط دفع لكل الفواتير */
  async function payAllDues() {
    const open = (data?.dues ?? []).filter((d) => d.due > 0);
    if (!open.length) return;
    setPayingAll(true);
    setPayAll([]);
    const out: { period: string; url?: string; error?: string }[] = [];
    for (const d of open) {
      try {
        const r = await fetch("/api/parent/pay", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: d.id, method: payMethod }),
          credentials: "include",
        });
        const j = await r.json().catch(() => null);
        out.push(r.ok && j?.ok ? { period: d.period, url: j.iframe_url } : { period: d.period, error: j?.error ?? "error" });
        setPayAll([...out]);
      } catch {
        out.push({ period: d.period, error: "conn" });
        setPayAll([...out]);
      }
    }
    setPayingAll(false);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("parent-lang");
      if (saved === "en" || saved === "ar") setLang(saved);
    } catch {}
    load();
  }, []);

  function switchLang(l: Lang) {
    setLang(l);
    try { localStorage.setItem("parent-lang", l); } catch {}
  }

  if (!data) return <div className="mx-auto max-w-md p-8 text-center text-slate-400">{err || t.loading}</div>;

  if (!onboarded) {
    return (
      <ParentOnboarding
        studentName={data.student.name}
        centerName={data.branding?.name || t.portal}
        telegram={data.telegram ?? { on: false }}
        onCheckTelegram={checkTelegramLinked}
        onDone={() => setOnboarded(true)}
      />
    );
  }

  return (
    <main className="mx-auto max-w-md p-4 space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Onboarding role="parent" />
      <div className="flex justify-end">
        <button onClick={() => switchLang(lang === "ar" ? "en" : "ar")}
          className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold">
          {lang === "ar" ? "English" : "عربي"}
        </button>
      </div>
      <header className="text-center">
        {data.branding?.logo_url && (
          <img src={data.branding.logo_url} alt={data.branding.name} className="mx-auto mb-2 h-16 w-16 rounded-2xl object-cover" />
        )}
        <h1 className="text-h1" style={{ color: data.branding?.primary_color || undefined }}>
          {data.branding?.name || t.portal} 🎓
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t.follow} <b>{data.student.name}</b> {t.live}</p>
      </header>

      <PushAutoPrompt />

      <NotificationsInbox source="parent" />

      <section className="card p-4">
        <PushSubscribeButton />
      </section>

      {data.telegram?.on && (
        <section className="card space-y-2 p-4">
          <p className="text-small font-bold">📨 تنبيهات تليجرام المجانية</p>
          {data.telegram.linked ? (
            <p className="text-xs font-bold text-success">✅ تليجرام مربوط — ستصلك التنبيهات هنا مجاناً.</p>
          ) : data.telegram.url ? (
            <>
              <p className="text-xs text-slate-600">اضغط الزر، ثم اضغط START في تليجرام — ويتم الربط تلقائياً.</p>
              <a href={data.telegram.url} target="_blank" rel="noopener noreferrer" className="btn-primary block w-full !py-2 text-center text-small">
                اربط تليجرام الآن 📨
              </a>
            </>
          ) : null}
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">{t.attendance}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-success/10 p-3 text-center"><div className="text-2xl font-extrabold text-success">{data.attendance.present}</div><div className="text-xs text-slate-500">{t.present}</div></div>
          <div className="rounded-xl bg-danger/10 p-3 text-center"><div className="text-2xl font-extrabold text-danger">{data.attendance.absent}</div><div className="text-xs text-slate-500">{t.absent}</div></div>
          <div className="rounded-xl bg-primary-light p-3 text-center"><div className="text-2xl font-extrabold text-primary">{data.attendance.total}</div><div className="text-xs text-slate-500">{t.total}</div></div>
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-bold">{t.grades}</h2>
        {data.grades.length === 0 ? (
          <p className="text-sm text-slate-500">{t.noGrades}</p>
        ) : (
          <ul className="space-y-2">
            {data.grades.map((g, i) => (
              <li key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-bold">{g.exam}</span>
                <span className="ml-2 font-extrabold text-primary" dir="ltr">{g.score}/{g.total ?? "?"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="checkout" className="card space-y-3 border-primary/25 bg-gradient-to-l from-primary-light/60 to-transparent p-4">
        <h2 className="font-bold">الدفع الموحد ⚡</h2>
        <div className="flex gap-2">
          {(["card", "wallet"] as const).map((m) => (
            <button key={m} onClick={() => setPayMethod(m)}
              className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-small font-bold transition ${payMethod === m ? "border-primary bg-primary-light text-primary" : "border-slate-200 text-slate-500"}`}>
              {m === "card" ? "💳 بطاقة بنكية" : "📱 محفظة إلكترونية"}
            </button>
          ))}
        </div>
        <button onClick={payAllDues} disabled={payingAll || !data.dues.some((d) => d.due > 0)} className="btn-primary w-full !py-3 text-base disabled:opacity-50">
          {payingAll ? t.paying : `ادفع الكل (${data.dues.filter((d) => d.due > 0).length} فواتير) ✅`}
        </button>
        {payAll !== null && payAll.length > 0 && (
          <ul className="space-y-2">
            {payAll.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-2.5 text-small">
                <span className="font-bold" dir="ltr">{p.period}</span>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-4 py-2 text-xs font-bold text-white">إتمام الدفع 🔗</a>
                ) : (
                  <span className="text-xs font-bold text-danger">تعذر — حاول لاحقاً</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-bold">{t.dues}</h2>
        {data.dues.length === 0 ? (
          <p className="text-sm text-success">{t.noDues}</p>
        ) : (
          <ul className="space-y-2">
            {data.dues.map((d, i) => (
              <li key={i} className="rounded-xl bg-danger/5 px-4 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold" dir="ltr">{d.period}</span>
                  <span className="font-extrabold text-danger">{d.due.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} {t.egp}</span>
                </div>
                {data.online_payment.enabled && d.due > 0 && (
                  <button onClick={() => pay(d.id)} disabled={paying} className="btn-primary mt-2 w-full !py-3 text-base disabled:opacity-50 sm:w-auto">
                    {paying ? t.paying : `${t.pay} ${d.due.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${t.egp} 💳`}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(() => {
        const open = data.dues.filter((d) => d.due > 0);
        if (!open.length) return null;
        const total = open.reduce((s, d) => s + d.due, 0);
        return (
          <>
            <div className="h-16 sm:hidden" aria-hidden />
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <div className="mx-auto flex max-w-md items-center justify-between gap-3">
                <span className="text-small">المستحق: <b className="text-danger">{total.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} {t.egp}</b></span>
                {data.online_payment.enabled && (
                  <a href="#checkout" className="btn-primary flex-1 !py-2 text-center text-small">
                    {t.pay} 💳
                  </a>
                )}
              </div>
            </div>
          </>
        );
      })()}

      <section className="card p-4">
        <h2 className="font-bold">{t.settings}</h2>
        <p className="mt-2 text-sm text-slate-500">{t.ePay}: {data.online_payment.enabled ? t.on : t.off}</p>
      </section>
    </main>
  );
}
