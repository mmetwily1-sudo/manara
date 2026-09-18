import { createClient } from "@supabase/supabase-js";

export default async function AdminHome() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let stats = { tenants: 0, active: 0, users: 0, tickets: 0 };

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const [tCount, aCount, uCount, tick] = await Promise.all([
      admin.from("tenants").select("id", { count: "exact", head: true }),
      admin.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    stats = { tenants: tCount.count ?? 0, active: aCount.count ?? 0, users: uCount.count ?? 0, tickets: tick.count ?? 0 };
  }

  const cards: [string, string | number][] = [
    ["السناتر", stats.tenants],
    ["نشط", stats.active],
    ["المستخدمون", stats.users],
    ["تذاكر مفتوحة", stats.tickets],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-h1">نظرة عامة</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="card p-5">
            <div className="text-h1 font-extrabold">{String(v)}</div>
            <div className="mt-1 text-small text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <a href="/admin/bank" className="card p-6 transition hover:border-primary/40">
          <div className="font-bold">البنك المركزي 🌍</div>
          <div className="mt-1 text-small text-slate-500">مراجعة المساهمات · فجوات التغطية</div>
        </a>
        <a href="/admin/tenants" className="card p-6 transition hover:border-primary/40">
          <div className="font-bold">إدارة السناتر</div>
          <div className="mt-1 text-small text-slate-500">بحث · تعليق · تغيير باقة</div>
        </a>
        <div className="card p-6">
          <div className="font-bold">تذاكر الدعم</div>
          <div className="mt-1 text-small text-slate-500">أول رد ≤ ساعتين — {stats.tickets} مفتوحة</div>
        </div>
      </div>
    </div>
  );
}
