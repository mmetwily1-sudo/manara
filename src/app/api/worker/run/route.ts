import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET/POST /api/worker/run — منفذ المهام الخلفية.
 * المصادقة: Bearer CRON_SECRET أو ?secret= (لـ UptimeRobot المجاني الذي لا يضبط هيدرات).
 * يُستدعى كل 5 دقائق خارجياً + كورون يومي احتياطي.
 */
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const u = new URL(req.url);
  const auth = req.headers.get("authorization") ?? "";
  const q = u.searchParams.get("secret") ?? "";
  const okCron = !!secret && (auth === `Bearer ${secret}` || (q && q === secret));
  if (!secret) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  if (!okCron) {
    // المالك يدوياً من لوحة التحكم
    const { requireTeacher } = await import("@/lib/server-auth");
    const res = await requireTeacher(["teacher_admin"]);
    if ("error" in res) return res.error;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !svc) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  try {
    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const { runDueJobs } = await import("@/lib/worker-jobs");
    const out = await runDueJobs(admin);
    return NextResponse.json({ ok: true, ...out });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
