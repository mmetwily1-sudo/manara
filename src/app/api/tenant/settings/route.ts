import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher, adminClient } from "@/lib/server-auth";
import { isWhatsAppLive } from "@/lib/whatsapp";
import { isVisionLive } from "@/lib/vision";

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
    has_vision_key: !!(settings.vision_key as string),
    has_vision_key_2: !!(settings.vision_key_2 as string),
    vision_live: isVisionLive((settings.vision_key as string) ?? null, (settings.vision_key_2 as string) ?? null),
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
  // رابط المنصة العام (slug مخصص): حروف لاتينية صغيرة وأرقام وشرطات — فريد ولا يتغير إلا هنا
  if (typeof body.slug !== "undefined") {
    const sl = String(body.slug ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(sl)) {
      return NextResponse.json({ ok: false, error: "bad_slug", message: "الرابط 3-30 حرفًا: حروف إنجليزية صغيرة وأرقام وشرطات." }, { status: 400 });
    }
    const admin0 = adminClient();
    const { data: taken } = await admin0.from("tenants").select("id").eq("slug", sl).neq("id", res.ctx.tenantId).limit(1);
    if (taken?.length) {
      return NextResponse.json({ ok: false, error: "slug_taken", message: "هذا الرابط محجوز — اختر غيره." }, { status: 400 });
    }
    const { error: slugErr } = await admin0.from("tenants").update({ slug: sl }).eq("id", res.ctx.tenantId);
    if (slugErr) return NextResponse.json({ ok: false, error: "slug_failed" }, { status: 500 });
    patch._slug = sl;
  }
  // ثيم صفحة المعلم العامة: default | dark | minimal
  if (typeof body.theme !== "undefined") {
    const th = String(body.theme ?? "");
    if (!["default", "dark", "minimal"].includes(th)) {
      return NextResponse.json({ ok: false, error: "bad_theme" }, { status: 400 });
    }
    patch.theme = th;
  }
  // مفتاحا Gemini للسنتر (تفريغ مرئي دقيق + تناوب عند نفاد الحصة) — فارغ = مسح
  // ملاحظة: مفاتيح AI Studio تحتوي نقاطاً (AQ.xxx) لذا تُقبل [A-Za-z0-9_.~-]
  for (const f of ["vision_key", "vision_key_2"]) {
    if (typeof (body as any)[f] !== "undefined") {
      const vk = String((body as any)[f] ?? "").trim();
      if (vk && !/^[A-Za-z0-9_.~-]{10,200}$/.test(vk)) {
        return NextResponse.json({ ok: false, error: "bad_key" }, { status: 400 });
      }
      patch[f] = vk || null;
    }
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
  const { _slug, ...settingsPatch } = patch as Record<string, unknown>;
  const settings = { ...(((t?.settings as any) ?? {}) as object), ...settingsPatch };
  const { error } = await admin
    .from("tenants")
    .update({ settings })
    .eq("id", res.ctx.tenantId);
  if (error) return dbFail("tenant-settings", error);
  return NextResponse.json({ ok: true, settings: { ...settingsPatch, ...(_slug ? { slug: _slug } : {}) } });
}
