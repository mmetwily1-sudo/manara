import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const ACTION_AR: Record<string, string> = {
  "auth:new_device": "دخول جديد 🔐",
  "gmail:test": "اختبار جيميل ✉️",
  "gmail:send": "إرسال بريد ✉️",
  "owner:impersonate": "متابعة بعين العميل 👁️",
};

function timeAgo(iso: string): string {
  try {
    const d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (d < 1) return "الآن";
    if (d < 60) return `منذ ${Math.floor(d)} دقيقة`;
    if (d < 1440) return `منذ ${Math.floor(d / 60)} ساعة`;
    return `منذ ${Math.floor(d / 1440)} يوم`;
  } catch { return ""; }
}

export default async function AdminHome() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let stats = { tenants: 0, active: 0, users: 0, tickets: 0 };
  let activity: any[] = [];
  let health = { queued: 0, dead: 0, failed24: 0 };

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const [tCount, aCount, uCount, tick] = await Promise.all([
      admin.from("tenants").select("id", { count: "exact", head: true }),
      admin.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    stats = { tenants: tCount.count ?? 0, active: aCount.count ?? 0, users: uCount.count ?? 0, tickets: tick.count ?? 0 };
    try {
      const { data } = await admin.from("audit_log").select("action,created_at,tenants(name)").order("created_at", { ascending: false }).limit(8);
      activity = (data ?? []) as any[];
    } catch {}
    try {
      const { data: jobs } = await admin.from("bg_jobs").select("status");
      for (const j of ((jobs ?? []) as any[])) {
        if (j.status === "queued") health.queued++;
        if (j.status === "dead") health.dead++;
      }
      const since = new Date(Date.now() - 864e5).toISOString();
      const { count } = await admin.from("notification_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since);
      health.failed24 = count ?? 0;
    } catch {}
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h1">نظرة عامة</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* في لمحة — طراز ووردبريس */}
        <section className="card p-5 lg:col-span-1">
          <h2 className="font-bold">في لمحة 📊</h2>
          <ul className="mt-3 space-y-2 text-small">
            {[["السناتر", stats.tenants], ["النشطة", stats.active], ["المستخدمون", stats.users], ["تذاكر مفتوحة", stats.tickets]].map(([label, v]) => (
              <li key={label as string} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">{label}</span>
                <span className="text-h2 font-extrabold text-primary">{String(v)}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/tenants" className="mt-3 inline-block text-xs font-bold text-primary">إدارة السناتر ←</Link>
        </section>

        {/* النشاط الأخير */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-bold">النشاط الأخير 🕘</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-small text-slate-400">لا نشاط مسجل بعد.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-small">
                  <span className="font-bold">{ACTION_AR[a.action] ?? a.action}</span>
                  <span className="truncate text-xs text-slate-500">{(a.tenants as any)?.name ?? ""}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* صحة المنصة */}
        <section className="card p-5">
          <h2 className="font-bold">صحة المنصة 💚</h2>
          <ul className="mt-3 space-y-2 text-small">
            <li className="flex justify-between"><span className="text-slate-500">مهام معلقة</span><b>{health.queued}</b></li>
            <li className="flex justify-between"><span className="text-slate-500">مهام ميتة</span><b className={health.dead ? "text-danger" : ""}>{health.dead}</b></li>
            <li className="flex justify-between"><span className="text-slate-500">إشعارات فاشلة 24h</span><b className={health.failed24 ? "text-danger" : ""}>{health.failed24}</b></li>
          </ul>
          <Link href="/admin/dev" className="mt-3 inline-block text-xs font-bold text-primary">لوحة المطور ←</Link>
        </section>

        {/* إجراءات سريعة */}
        <section className="card p-5">
          <h2 className="font-bold">إجراءات سريعة ⚡</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-small">
            {[
              ["/admin/billing", "💰 الفوترة"],
              ["/admin/impersonate", "👁️ المتابعة"],
              ["/admin/tenants", "🏫 السناتر"],
              ["/admin/dev", "🛠️ المطور"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-xl bg-slate-50 px-4 py-3 text-center font-bold transition hover:bg-primary-light hover:text-primary">
                {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
