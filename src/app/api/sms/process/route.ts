import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/sms/process — معالجة طابور SMS (كرون يومي 45 8 UTC + يدوي المالك).
 * المزود الحالي log (يسجل فقط) — فعّل Twilio عبر SMS_DRIVER لاحقاً.
 */
export async function GET(req: Request) {
  return run(req, true);
}

export async function POST(req: Request) {
  return run(req, false);
}

async function run(req: Request, isCronGet: boolean) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const isCron = !!secret && auth === `Bearer ${secret}`;
  if (!isCron && !isCronGet) {
    const { requireTeacher } = await import("@/lib/server-auth");
    const res = await requireTeacher(["teacher_admin"]);
    if ("error" in res) return res.error;
  }
  if (!isCron && isCronGet) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  try {
    const { processSmsBatch } = await import("@/lib/sms");
    const out = await processSmsBatch(admin, 50);
    return NextResponse.json({ ok: true, driver: process.env.SMS_DRIVER ?? "log", ...out });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
