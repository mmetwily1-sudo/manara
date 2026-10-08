import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** GET /api/renewals/run — كرون التجديد اليومي (مؤمّن بـ CRON_SECRET، بنمط invoices/remind/run) */
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
    const { runRenewals } = await import("@/lib/renewals");
    const out = await runRenewals(admin);
    return NextResponse.json({ ok: true, ...out });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
