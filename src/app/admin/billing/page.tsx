import { createClient } from "@supabase/supabase-js";

/**
 * فوترة المنصة: إيراد الاشتراكات + استهلاك القنوات لكل سنتر (أساس محاسبة الرسائل).
 */
export default async function AdminBillingPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let mrr = { total: 0, count: 0 };
  let waRows: any[] = [];
  let smsPending = 0;
  let notif30 = 0;
  const month = new Date().toISOString().slice(0, 7);

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    try {
      const { data: inv } = await admin.from("platform_invoices").select("amount").eq("status", "paid").gte("paid_at", `${month}-01`);
      mrr = { total: ((inv ?? []) as any[]).reduce((s, x) => s + Number(x.amount ?? 0), 0), count: (inv ?? []).length };
    } catch {}
    try {
      const { data } = await admin.from("wa_usage").select("count,tenants(name)").eq("month", month).order("count", { ascending: false }).limit(30);
      waRows = (data ?? []) as any[];
    } catch {}
    try {
      const { count } = await admin.from("sms_queue").select("id", { count: "exact", head: true }).eq("status", "queued");
      smsPending = count ?? 0;
    } catch {}
    try {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { count } = await admin.from("notification_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", since);
      notif30 = count ?? 0;
    } catch {}
  }

  const waTotal = waRows.reduce((s, r) => s + Number(r.count ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-h1">فوترة المنصة 💰</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["محصّل هذا الشهر", `${mrr.total.toLocaleString("ar-EG")} ج`, `${mrr.count} فاتورة`],
          ["واتساب هذا الشهر", waTotal.toLocaleString("ar-EG"), "من 1000 مجاناً"],
          ["SMS معلق", smsPending.toLocaleString("ar-EG"), "في الطابور"],
          ["تنبيهات 30 يوم", notif30.toLocaleString("ar-EG"), "مرسلة"],
        ].map(([label, v, sub]) => (
          <div key={label as string} className="card p-5">
            <div className="text-h1 font-extrabold">{v}</div>
            <div className="mt-1 text-small text-slate-500">{label} · {sub}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 font-bold">استهلاك واتساب لكل سنتر — {month}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-right text-small">
            <thead className="bg-slate-900 text-xs text-slate-300">
              <tr><th className="px-4 py-3 font-semibold">السنتر</th><th className="px-4 py-3 font-semibold">الرسائل</th><th className="px-4 py-3 font-semibold">الحالة</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {waRows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">لا استهلاك بعد — القناة تعمل لحظة وضع التوكن</td></tr>
              )}
              {waRows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-bold">{(r.tenants as any)?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono" dir="ltr">{r.count}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-bold text-success">ضمن المجاني</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
