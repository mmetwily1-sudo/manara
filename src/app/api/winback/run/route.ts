import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/winback/run — إعادة تنشيط تلقائية أسبوعية (cron، مؤمّن بـ CRON_SECRET).
 * تجارب منتهية منذ 3-14 يوماً بلا تمديد سابق → +3 أيام مرة واحدة + تدقيق.
 */
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
    const from = new Date(Date.now() - 14 * 864e5).toISOString();
    const to = new Date(Date.now() - 3 * 864e5).toISOString();
    const { data: tenants } = await admin.from("tenants").select("id,trial_ends_at,settings")
      .eq("plan", "trial").eq("status", "active")
      .gte("trial_ends_at", from).lte("trial_ends_at", to).limit(50);
    let revived = 0;
    for (const t of (tenants ?? []) as any[]) {
      try {
        const settings = (t.settings ?? {}) as any;
        if (settings.trial_winback) continue;
        const next = new Date(Date.now() + 3 * 864e5).toISOString();
        await admin.from("tenants").update({
          trial_ends_at: next, settings: { ...settings, trial_winback: true },
        }).eq("id", t.id);
        await admin.from("audit_log").insert({
          tenant_id: t.id, actor_id: null,
          action: "trial:winback", entity_type: "tenant", entity_id: t.id, details: { days: 3 },
        });
        revived++;
      } catch {}
    }
    return NextResponse.json({ ok: true, revived });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
