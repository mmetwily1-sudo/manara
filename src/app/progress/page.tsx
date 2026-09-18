"use client";

import { useEffect, useState } from "react";

type Progress = {
  ok: boolean;
  student: { name: string };
  billing: { paid: number; expected: number; outstanding: number; pay_numbers: Record<string, string> };
  stats: { exams_taken: number; avg_score: number | null; certificates: number };
  attempts: { id: string; exam_title: string; score: number; total: number; submitted_at: string }[];
  certificates: { serial_code: string; title: string; score: number; created_at: string }[];
  groups: { id: string; name: string; subject: string | null }[];
  videos: { id: string; title: string; visibility: string }[];
};

const PAY_LABELS: Record<string, string> = { instapay: "انستاباي", wallet: "محفظة", fawry: "فوري" };

export default function ProgressPage() {
  const [data, setData] = useState<Progress | null>(null);
  const [err, setErr] = useState("");
  const [claim, setClaim] = useState({ amount: "", method: "instapay", reference: "" });
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");

  async function onClaim(e: React.FormEvent) {
    e.preventDefault();
    setClaimBusy(true); setClaimMsg("");
    try {
      const r = await fetch("/api/payments/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...claim, amount: Number(claim.amount) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setClaimMsg("تم إرسال بلاغ الدفع — سيؤكده المعلم قريباً ✅");
        setClaim({ amount: "", method: "instapay", reference: "" });
      } else setClaimMsg(j?.message ?? "فشل الإرسال: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setClaimMsg("تعذر الاتصال بالخادم."); }
    setClaimBusy(false);
  }

  useEffect(() => {
    fetch("/api/me/progress")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) setData(j);
        else setErr(j?.error === "unauth" ? "سجّل دخولك أولاً لعرض تقدمك." : "تعذر تحميل بيانات التقدم.");
      })
      .catch(() => setErr("تعذر الاتصال بالخادم."));
  }, []);

  if (err) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <div className="text-h1">📊</div>
        <p className="font-bold">{err}</p>
        <a href="/login" className="btn-primary inline-block">تسجيل الدخول</a>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-3xl p-8 text-center text-slate-400">جاري تحميل تقدمك...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="text-h1">تقدمي الدراسي 🎯</h1>
        <p className="mt-1 text-small text-slate-500">أهلاً {data.student.name} — كل نتائجك وشهاداتك في مكان واحد</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["امتحانات", data.stats.exams_taken],
          ["متوسط الدرجات", data.stats.avg_score ?? "—"],
          ["شهادات", data.stats.certificates],
        ].map(([label, val]) => (
          <div key={label as string} className="card p-4 text-center">
            <div className="text-h1 font-extrabold text-primary">{val}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {data.certificates.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">شهاداتي 🎓</h2>
          <ul className="space-y-2">
            {data.certificates.map((c) => (
              <li key={c.serial_code} className="flex items-center justify-between gap-3 rounded-xl bg-success/5 px-4 py-2.5 text-small">
                <span className="font-bold">{c.title}</span>
                <a href={`/verify/${c.serial_code}`} className="font-mono text-xs font-bold text-primary" dir="ltr">{c.serial_code}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">نتائج الامتحانات 📝</h2>
        {data.attempts.length === 0 ? (
          <p className="text-small text-slate-500">لم تؤدِ أي امتحان بعد.</p>
        ) : (
          <ul className="space-y-2">
            {data.attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span className="font-bold">{a.exam_title}</span>
                <span className="text-slate-600">
                  {a.score}/{a.total} · {new Date(a.submitted_at).toLocaleDateString("ar-EG")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.billing && (
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">اشتراكي الشهري 💳</h2>
            <div className="text-small">
              مدفوع: <b className="text-success">{data.billing.paid}</b>
              {" · "}المتبقي: <b className={data.billing.outstanding > 0 ? "text-danger" : "text-success"}>{data.billing.outstanding} جنيه</b>
            </div>
          </div>
          {data.billing.outstanding > 0 && (
            <>
              {Object.keys(data.billing.pay_numbers ?? {}).length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-small">
                  <div className="mb-1 text-xs font-bold text-slate-500">حوّل على أحد الأرقام التالية ثم أبلغنا:</div>
                  {Object.entries(data.billing.pay_numbers).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5">
                      <span>{PAY_LABELS[k] ?? k}</span>
                      <span className="font-mono font-bold" dir="ltr">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={onClaim} className="grid gap-2 sm:grid-cols-4">
                <input value={claim.amount} onChange={(e) => setClaim({ ...claim, amount: e.target.value })}
                  placeholder="المبلغ" inputMode="decimal" required className="rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary" />
                <select value={claim.method} onChange={(e) => setClaim({ ...claim, method: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2">
                  <option value="instapay">انستاباي</option>
                  <option value="wallet">محفظة</option>
                  <option value="fawry">فوري</option>
                  <option value="card">بطاقة</option>
                </select>
                <input value={claim.reference} onChange={(e) => setClaim({ ...claim, reference: e.target.value })}
                  placeholder="رقم العملية" required className="rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary" />
                <button className="btn-primary !py-2 text-small" disabled={claimBusy}>{claimBusy ? "جاري..." : "أبلغت بالدفع"}</button>
              </form>
              {claimMsg && <p className="text-small font-bold text-primary">{claimMsg}</p>}
            </>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">مجموعاتي 👥</h2>
          {data.groups.length === 0 ? (
            <p className="text-small text-slate-500">غير مسجل في مجموعات بعد.</p>
          ) : (
            <ul className="space-y-2">
              {data.groups.map((g) => (
                <li key={g.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-small font-bold">
                  {g.name}{g.subject ? ` · ${g.subject}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">فيديوهاتي 🎬</h2>
          {data.videos.length === 0 ? (
            <p className="text-small text-slate-500">لا توجد فيديوهات متاحة بعد.</p>
          ) : (
            <ul className="space-y-2">
              {data.videos.slice(0, 8).map((v) => (
                <li key={v.id}>
                  <a href={`/watch/${v.id}`} className="block rounded-xl bg-slate-50 px-4 py-2.5 text-small font-bold text-primary transition hover:bg-primary-light">
                    ▶ {v.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
