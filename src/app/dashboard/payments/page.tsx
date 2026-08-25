import { DEMO_STUDENTS } from "@/lib/demo-data";

const payments = [
  { name: "أحمد محمود", amount: "600 ج", status: "مدفوع", method: "كاش", time: "اليوم" },
  { name: "سارة علي", amount: "300 من 600 ج", status: "جزئي", method: "انستاباي", time: "اليوم" },
  { name: "يوسف حسن", amount: "1,200 ج", status: "متأخر", method: "—", time: "شهرين" },
  { name: "مريم عادل", amount: "600 ج", status: "مدفوع", method: "كاش", time: "امبارح" },
];

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">التحصيل</h1>
          <p className="mt-1 text-small text-slate-500">دورة الشهر · صفر عمولة</p>
        </div>
        <button className="btn-primary text-small">تقفيل الخزنة</button>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[["المحصّل النهاردة", "900 ج", "primary"], ["محصّل الشهر", "12,400 ج", "success"], ["المتبقي", "1,800 ج", "warning"]].map(([l, v, tone]) => (
          <div key={l as string} className="card p-5">
            <div className={`text-2xl font-extrabold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary"}`}>{v}</div>
            <div className="mt-1 text-small text-slate-500">{l}</div>
          </div>
        ))}
      </section>

      {/* المتأخرين أولاً (نمط حاضر: بالاسم والمبلغ وإنت فاهم) */}
      <section className="card p-6">
        <h2 className="mb-4 font-bold text-warning">المتأخرات — بالاسم والمبلغ</h2>
        <ul className="divide-y divide-slate-100">
          {[["يوسف حسن", "1,200 ج — شهرين"], ["سارة علي", "300 ج متبقية من الشهر"]].map(([n, d]) => (
            <li key={n} className="flex items-center justify-between py-3">
              <div><div className="text-small font-bold">{n}</div><div className="mt-0.5 text-xs text-slate-500">{d}</div></div>
              <button className="btn-secondary !px-4 !py-1.5 text-xs">استلمت دفعة</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <table className="w-full text-right text-small">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{["الطالب", "المبلغ", "الحالة", "الطريقة", "الوقت"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.name}>
                <td className="px-4 py-3 font-bold">{p.name}</td>
                <td className="px-4 py-3">{p.amount}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${p.status === "مدفوع" ? "bg-success/10 text-success" : p.status === "جزئي" ? "bg-primary-light text-primary" : "bg-warning/10 text-warning"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{p.method}</td>
                <td className="px-4 py-3 text-slate-400">{p.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
