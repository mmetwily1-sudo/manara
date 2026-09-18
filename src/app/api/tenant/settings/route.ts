import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";
import { isWhatsAppLive } from "@/lib/whatsapp";

/** GET — حالة الإشعارات وإعداد الواتساب */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("settings")
    .eq("id", res.ctx.tenantId)
    .single();
  const settings = (t?.settings as any) ?? {};
  return NextResponse.json({
    ok: true,
    whatsapp_configured: isWhatsAppLive(),
    notify_whatsapp: settings.notify_whatsapp !== false,
  });
}

/** PATCH — { notify_whatsapp: boolean } */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const body = await req.json().catch(() => ({} as any));
  if (typeof body.notify_whatsapp !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });
  }
  const admin = adminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("settings")
    .eq("id", res.ctx.tenantId)
    .single();
  const settings = { ...(((t?.settings as any) ?? {}) as object), notify_whatsapp: body.notify_whatsapp };
  const { error } = await admin
    .from("tenants")
    .update({ settings })
    .eq("id", res.ctx.tenantId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notify_whatsapp: body.notify_whatsapp });
}
