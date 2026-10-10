import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/digests/run-monthly — الملخص الشهري المجدول (يوم 1، 07:30 UTC = 10:30 القاهرة، مؤمّن بـ CRON_SECRET).
 * لكل سنتر نشط (50/تشغيلة): ملخص 30 يوماً لكل طالب + push — يُتخطى الموجود (unique).
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
    const { buildDigest } = await import("@/lib/digest");
    const { sendPushToUser } = await import("@/lib/push");
    const period = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const { data: tenants } = await admin.from("tenants").select("id,name").eq("status", "active").limit(50);
    let tenantsDone = 0, created = 0, pushed = 0, waFallback = 0;
    for (const t of (tenants ?? []) as any[]) {
      const { data: students } = await admin.from("users").select("id,full_name")
        .eq("tenant_id", t.id).eq("role", "student").limit(300);
      for (const s of (students ?? []) as any[]) {
        try {
          const d = await buildDigest(admin, t.id, s.id, 30, "monthly");
          const { error } = await admin.from("parent_digests").insert({
            tenant_id: t.id, student_id: s.id, period, payload: d, wa_text: d.wa_text,
          });
          if (!error) {
            created++;
            const r = await sendPushToUser(admin, t.id, s.id, {
              title: "التقرير الشهري 📊",
              body: `حضور ${d.present} · غياب ${d.absent}${d.due > 0 ? ` · مستحق ${d.due} ج` : ""}`,
              url: "/progress",
            });
            pushed += r.sent;
            if (!r.sent && d.wa_text) {
              try {
                const { notifyStudent } = await import("@/lib/notify");
                const w = await notifyStudent(admin, {
                  tenantId: t.id, studentId: s.id,
                  event: {
                    kind: "digest_weekly", studentName: String(s.full_name ?? ""),
                    centerName: String(t.name ?? ""), text: String(d.wa_text).slice(0, 1000),
                  },
                  dedupeKey: `digest-wa-monthly:${period}:${s.id}`,
                });
                if (w.sent) waFallback++;
              } catch {}
            }
          }
        } catch {}
      }
      tenantsDone++;
    }
    return NextResponse.json({ ok: true, tenantsDone, created, pushed, waFallback, period, mode: "monthly" });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
