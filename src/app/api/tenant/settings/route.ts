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
    pay_numbers: settings.pay_numbers ?? {},
  });
}

/** PATCH — { notify_whatsapp?: boolean; pay_numbers?: { instapay?, wallet?, fawry? } } */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const body = await req.json().catch(() => ({} as any));
  const patch: Record<string, unknown> = {};
  if (typeof body.notify_whatsapp === "boolean") patch.notify_whatsapp = body.notify_whatsapp;
  if (body.pay_numbers && typeof body.pay_numbers === "object") {
    const pn: Record<string, string> = {};
    for (const k of ["instapay", "wallet", "fawry"]) {
      const v = String((body.pay_numbers as any)[k] ?? "").trim().slice(0, 30);
      if (v) pn[k] = v;
    }
    patch.pay_numbers = pn;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });
  }
  const admin = adminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("settings")
    .eq("id", res.ctx.tenantId)
    .single();
  const settings = { ...(((t?.settings as any) ?? {}) as object), ...patch };
  const { error } = await admin
    .from("tenants")
    .update({ settings })
    .eq("id", res.ctx.tenantId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: patch });
}
