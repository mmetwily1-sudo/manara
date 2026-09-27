"use client";

import { useEffect, useState } from "react";

type Data = {
  student: { name: string; phone: string | null };
  attendance: { present: number; absent: number; total: number };
  grades: { exam: string; score: number; total: number | null; at: string }[];
  dues: { id: string; period: string; amount: number; paid: number; due: number; status: string; receipt: number | null }[];
  online_payment: { enabled: boolean };
};

export default function ParentPortal() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/parent/portal", { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setData(j);
      else setErr(j?.error || "تعذر التحميل");
    } catch { setErr("تعذر الاتصال"); }
  }

  async function pay(invoiceId: string) {
    try {
      const r = await fetch("/api/parent/pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, method: "card" }),
        credentials: "include",
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) window.location.href = j.iframe_url;
      else alert(j?.error ?? "تعذر إنشاء رابط الدفع");
    } catch { alert("تعذر الاتصال"); }
  }

  useEffect(() => { load(); }, []);

  if (!data) return <div className="mx-auto max-w-md p-8 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <main className="mx-auto max-w-md p-4 space-y-4" dir="rtl">
      <header className="text-center">
        <h1 className="text-h1">بوابة ولي الأمر 👨‍👩‍👧</h1>
        <p className="mt-2 text-sm text-slate-500">متابعة ابنك <b>{data.student.name}</b> لحظة بلحظة</p>
      </header>

      <section className="card space-y-3 p-4">
        <h2 className="font-bold">الحضور الشهري 📊</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-success/10 p-3 text-center"><div className="text-2xl font-extrabold text-success">{data.attendance.present}</div><div className="text-xs text-slate-500">حاضر</div></div>
          <div className="rounded-xl bg-danger/10 p-3 text-center"><div className="text-2xl font-extrabold text-danger">{data.attendance.absent}</div><div className="text-xs text-slate-500">غائب</div></div>
          <div className="rounded-xl bg-primary-light p-3 text-center"><div className="text-2xl font-extrabold text-primary">{data.attendance.total}</div><div className="text-xs text-slate-500">إجمالي</div></div>
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-bold">الدرجات 📝</h2>
        {data.grades.length === 0 ? (
          <p className="text-sm text-slate-500">لا درجات مسجلة بعد.</p>
        ) : (
          <ul className="space-y-2">
            {data.grades.map((g, i) => (
              <li key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-bold">{g.exam}</span>
                <span className="ml-2 font-extrabold text-primary">{g.score}/{g.total ?? "?"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-bold">المستحقات 💰</h2>
        {data.dues.length === 0 ? (
          <p className="text-sm text-success">لا متأخرات ✅</p>
        ) : (
          <ul className="space-y-2">
            {data.dues.map((d, i) => (
              <li key={i} className="rounded-xl bg-danger/5 px-4 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold">{d.period}</span>
                  <span className="font-extrabold text-danger">{d.due.toLocaleString("ar-EG")} ج</span>
                </div>
                {data.online_payment.enabled && d.due > 0 && (
                  <button onClick={() => pay(d.id)} disabled={paying} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                    {paying ? "جاري..." : `ادفع ${d.due.toLocaleString("ar-EG")} ج 💳`}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-bold">إعدادات 🔧</h2>
        <p className="mt-2 text-sm text-slate-500">الدفع الإلكتروني: {data.online_payment.enabled ? "مفعل ✅" : "غير مفعل — تواصل مع الإدارة"}</p>
      </section>
    </main>
  );
}