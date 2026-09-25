"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PhoneLoginForm } from "@/components/PhoneLoginForm";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";

export const dynamic = "force-dynamic";

function ParentInner() {
  const sp = useSearchParams();
  const [slug, setSlug] = useState(sp.get("slug") ?? "");
  const [go, setGo] = useState(!!sp.get("slug"));

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

      {!go ? (
        <form onSubmit={(e) => { e.preventDefault(); if (slug.trim()) setGo(true); }} className="card space-y-3 p-5">
          <label className="block text-small font-bold">رابط سنتر ابنك (الاسم المختصر)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value.trim())} placeholder="مثال: nour-center" dir="ltr"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
          <button className="btn-primary w-full">متابعة ←</button>
          <p className="text-center text-xs text-slate-400">تلاقيه في أي رابط مبعوت من السنتر — أو اسأل الإدارة.</p>
        </form>
      ) : (
        <div className="space-y-4">
          <PhoneLoginForm slug={slug} />
          <div className="card space-y-3 p-5">
            <h2 className="text-small font-bold">🔔 فعّل إشعارات الغياب والنتائج على جهازك</h2>
            <PushSubscribeButton />
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
