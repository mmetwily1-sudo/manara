import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** GET /api/attendance/audit/run — كرون تدقيق الحصص بلا تسجيل (مؤمّن بـ CRON_SECRET) */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  try {
    const { runAttendanceAudit } = await import("@/lib/attendance-audit");
    const out = await runAttendanceAudit(admin);
    return NextResponse.json({ ok: true, ...out });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
