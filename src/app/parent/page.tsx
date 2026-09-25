"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PhoneLoginForm } from "@/components/PhoneLoginForm";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";

export const dynamic = "force-dynamic";

const STEPS = ["السنتر", "الدخول", "التنبيهات", "التثبيت"];

function ParentInner() {
  const sp = useSearchParams();
  const [slug, setSlug] = useState(sp.get("slug") ?? "");
  const [go, setGo] = useState(!!sp.get("slug"));
  const [doneInstall, setDoneInstall] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("manara.parent.installed.v1")) setDoneInstall(true); } catch {}
  }, []);
  const step = !go ? 0 : 1;

  useEffect(() => {
    const q = sp.get("slug");
    if (q) { setSlug(q); setGo(true); }
  }, [sp]);

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <header className="text-center">
        <div className="text-5xl">👨‍👩‍👧</div>
        <h1 className="mt-3 text-h1">بوابة ولي الأمر</h1>
        <p className="mt-2 text-small text-slate-500">
          ادخل برقم موبايل الطالب المسجل في السنتر — يصلك رمز واتساب وتتابع الحضور والدرجات والمدفوعات لحظة بلحظة.
        </p>
      </header>

      <ol className="flex items-center gap-1" dir="ltr">
        {STEPS.map((s, i) => {
          const active = (!go && i === 0) || (go && !doneInstall && i <= 2) || (go && doneInstall && i <= 3);
          const current = (!go && i === 0) || (go && !doneInstall && i === 2) || (go && doneInstall && i === 3);
          return (
            <li key={s} className="flex flex-1 items-center gap-1 last:flex-none">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>{i + 1}</span>
              <span className={`text-[11px] font-bold ${current ? "text-primary" : "text-slate-400"}`} dir="rtl">{s}</span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
            </li>
          );
        })}
      </ol>

      {!go ? (
        <form onSubmit={(e) => { e.preventDefault(); if (slug.trim()) setGo(true); }} className="card space-y-3 p-5">
          <label className="block text-small font-bold">خطوة 1: رابط سنتر ابنك (الاسم المختصر)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value.trim())} placeholder="مثال: nour-center" dir="ltr"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
          <button className="btn-primary w-full">متابعة ←</button>
          <p className="text-center text-xs text-slate-400">تلاقيه في أي رابط مبعوت من السنتر — أو اسأل الإدارة.</p>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="card space-y-3 p-5">
            <h2 className="text-small font-bold">خطوة 2: الدخول برقم الموبايل</h2>
            <PhoneLoginForm slug={slug} />
          </div>
          <div className="card space-y-3 p-5">
            <h2 className="text-small font-bold">خطوة 3: 🔔 فعّل إشعارات الغياب والنتائج على جهازك</h2>
            <PushSubscribeButton />
          </div>
          <div className="card space-y-2 p-5">
            <h2 className="text-small font-bold">خطوة 4: 📲 ثبّت البوابة على شاشتك</h2>
            <p className="text-xs leading-relaxed text-slate-500">أندرويد (كروم): القائمة ⋮ ← إضافة إلى الشاشة الرئيسية. آيفون (سفاري): مشاركة ← إضافة للشاشة الرئيسية.</p>
            {!doneInstall ? (
              <button onClick={() => { try { localStorage.setItem("manara.parent.installed.v1", "1"); } catch {} setDoneInstall(true); }} className="btn-secondary w-full !py-2 text-small">تم التثبيت ✅</button>
            ) : (
              <p className="text-xs font-bold text-success">ممتاز — بوابتك جاهزة! تابع من <a href="/progress" className="underline">صفحة التقدم</a>.</p>
            )}
          </div>
          <button onClick={() => setGo(false)} className="w-full text-center text-xs font-bold text-slate-400">تغيير السنتر</button>
        </div>
      )}

      <section className="card space-y-2 p-5 text-small text-slate-600">
        <div className="font-bold">ليه البوابة؟</div>
        <ul className="space-y-1.5 text-small">
          <li>✅ حضور وغياب ابنك أول بأول — بلا اتصال ولا سؤال.</li>
          <li>✅ درجات الامتحانات والشهادات في مكان واحد.</li>
          <li>✅ إيصالات الدفع والمستحق عليك أول بأول.</li>
          <li>✅ ثبّتها على شاشتك: من متصفح موبايلك ← إضافة للشاشة الرئيسية.</li>
        </ul>
      </section>
    </main>
  );
}

export default function ParentPage() {
  return (
    <Suspense>
      <ParentInner />
    </Suspense>
  );
}
