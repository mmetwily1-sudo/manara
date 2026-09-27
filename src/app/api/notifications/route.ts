import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/notifications — المركز الموحد: سجل الإشعارات + طابور SMS (كل الطاقم) */
export async function GET() {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const [{ data: log }, { data: sms }] = await Promise.all([
    admin.from("notification_log").select("id,event,channel,status,sent_at,created_at,user_id")
      .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100),
    admin.from("sms_queue").select("id,phone,event,status,attempts,created_at")
      .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(50),
  ]);
  const sids = Array.from(new Set(((log ?? []) as any[]).map((l) => l.user_id).filter(Boolean)));
  let people: Record<string, string> = {};
  if (sids.length) {
    const { data: st } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
    (st ?? []).forEach((s: any) => { people[s.id] = s.full_name; });
  }
  return NextResponse.json({
    ok: true,
    log: ((log ?? []) as any[]).map((l) => ({ ...l, student: people[l.user_id] ?? "—" })),
    sms: sms ?? [],
  });
}
