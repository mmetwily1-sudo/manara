import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** GET /api/invoices/remind/run — التذكير اليومي المجدول (cron 08:00 UTC = 11:00 القاهرة، مؤمّن بـ CRON_SECRET) */
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
    const { remindTenant } = await import("@/lib/remind");
    const { data: tenants } = await admin.from("tenants").select("id").eq("status", "active").limit(100);
    let reminded = 0, tenantsDone = 0;
    for (const t of (tenants ?? []) as any[]) {
      try {
        const r = await remindTenant(admin, t.id);
        reminded += r.reminded;
      } catch {}
      tenantsDone++;
    }
    return NextResponse.json({ ok: true, tenantsDone, reminded });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
