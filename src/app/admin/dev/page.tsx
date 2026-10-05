import { createClient } from "@supabase/supabase-js";

/**
 * لوحة المطور: صحة المنصة تقنياً — الإصدار، الطوابير، الفشل، المفاتيح (وجود فقط، بلا قيم).
 */
export default async function AdminDevPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "محلي";
  const env = process.env.VERCEL_ENV ?? "development";

  let jobs: Record<string, number> = {};
  let failed24 = 0;
  let queueSms = 0;

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    try {
      const { data } = await admin.from("bg_jobs").select("status");
      for (const j of ((data ?? []) as any[])) jobs[j.status] = (jobs[j.status] ?? 0) + 1;
    } catch {}
    try {
      const since = new Date(Date.now() - 864e5).toISOString();
      const { count } = await admin.from("notification_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since);
      failed24 = count ?? 0;
    } catch {}
    try {
      const { count } = await admin.from("sms_queue").select("id", { count: "exact", head: true }).eq("status", "queued");
      queueSms = count ?? 0;
    } catch {}
  }

  const keys: [string, boolean][] = [
    ["Supabase URL", !!(process.env.NEXT_PUBLIC_SUPABASE_URL)],
    ["Supabase Anon", !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
    ["Service Role", !!(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["Paymob", !!(process.env.PAYMOB_SECRET_KEY)],
    ["Resend", !!(process.env.RESEND_API_KEY)],
    ["Telegram Bot", !!((process.env.TELEGRAM_BOT_TOKEN ?? "").length)],
    ["WhatsApp", !!((process.env.WHATSAPP_ACCESS_TOKEN ?? "").length)],
    ["Twilio", !!((process.env.TWILIO_ACCOUNT_SID ?? "").length)],
    ["VAPID", !!(process.env.VAPID_PRIVATE_KEY)],
    ["CRON Secret", !!(process.env.CRON_SECRET)],
    ["Gemini 1-6", [1, 2, 3, 4, 5, 6].some((i) => !!((process.env as any)[i === 1 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${i}`] ?? ""))],
  ];

  const badge = (ok: boolean) => (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
      {ok ? "✅" : "❌"}
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">لوحة المطور 🛠️</h1>
        <p className="mt-1 text-small text-slate-500">
          الإصدار <span className="font-mono font-bold" dir="ltr">{sha}</span> · البيئة {env}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["مهام queued", jobs.queued ?? 0],
          ["مهام running", jobs.running ?? 0],
          ["مهام dead", jobs.dead ?? 0],
          ["إشعارات فاشلة 24h", failed24],
        ].map(([label, v]) => (
          <div key={label as string} className="card p-5">
            <div className="text-h1 font-extrabold">{String(v)}</div>
            <div className="mt-1 text-small text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="card space-y-2 p-5">
        <h2 className="font-bold">المفاتيح والقنوات (وجود فقط)</h2>
        <ul className="divide-y divide-slate-100">
          {keys.map(([label, ok]) => (
            <li key={label} className="flex items-center justify-between py-2 text-small">
              <span className="font-bold">{label}</span>
              {badge(ok)}
            </li>
          ))}
        </ul>
        {!keys.find(([, ok]) => !ok) ? null : (
          <p className="text-xs text-slate-400">❌ = يُضبط من البيئة (Vercel → Settings → Environment Variables) ثم إعادة نشر</p>
        )}
      </div>

      <div className="card space-y-2 p-5">
        <h2 className="font-bold">روابط التشغيل</h2>
        <div className="flex flex-wrap gap-2 text-small">
          <a href="/api/health" target="_blank" rel="noreferrer" className="btn-secondary !px-4 !py-2 text-small">فحص الصحة</a>
          <a href="/api/worker/run" target="_blank" rel="noreferrer" className="btn-secondary !px-4 !py-2 text-small">تشغيل العامل (يحتاج سر)</a>
          <a href="/admin/impersonate" className="btn-secondary !px-4 !py-2 text-small">المتابعة بعين العميل</a>
        </div>
      </div>
    </div>
  );
}
