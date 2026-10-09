import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

const ALLOWED = ["payment_received", "student_registered", "exam_graded", "trial_started"];

/** GET /api/webhooks — ويبهوكات السنتر + آخر التسليمات (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const { data: hooks } = await admin.from("outgoing_webhooks")
    .select("id,url,events,is_active,created_at").eq("tenant_id", res.ctx.tenantId).limit(50);
  const { data: dlv } = await admin.from("webhook_deliveries")
    .select("event,status_code,ok,created_at,webhook_id").eq("tenant_id", res.ctx.tenantId)
    .order("created_at", { ascending: false }).limit(30);
  return NextResponse.json({ ok: true, hooks: hooks ?? [], deliveries: dlv ?? [], allowed: ALLOWED });
}

/** POST /api/webhooks {url, events[], secret?} — ويبهوك جديد */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const url = String(b?.url ?? "").trim().slice(0, 500);
  if (!/^https:\/\/.{4,}/.test(url)) return NextResponse.json({ ok: false, error: "https_only" }, { status: 400 });
  const events = Array.isArray(b?.events) ? b.events.filter((e: string) => ALLOWED.includes(e)) : ["payment_received"];
  if (!events.length) return NextResponse.json({ ok: false, error: "no_events" }, { status: 400 });
  const { data, error } = await res.ctx.admin.from("outgoing_webhooks").insert({
    tenant_id: res.ctx.tenantId, url, events,
    secret: String(b?.secret ?? "").trim().slice(0, 200),
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("webhook-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/webhooks {id, is_active} — تفعيل/إيقاف */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const { error } = await res.ctx.admin.from("outgoing_webhooks").update({ is_active: !!b?.is_active })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("webhook-update", error);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/webhooks?id= — حذف ويبهوك */
export async function DELETE(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  const { error } = await res.ctx.admin.from("outgoing_webhooks").delete()
    .eq("id", id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("webhook-delete", error);
  return NextResponse.json({ ok: true });
}
