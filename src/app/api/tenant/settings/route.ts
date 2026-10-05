import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher, adminClient } from "@/lib/server-auth";
import { isWhatsAppLive } from "@/lib/whatsapp";
import { isVisionLive } from "@/lib/vision";

/** تباين اللون مع الأبيض (WCAG) — حارس القراءة */
function contrastWhite(hex: string): number {
  const c = hex.replace("#", "");
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * f(parseInt(c.slice(0, 2), 16)) + 0.7152 * f(parseInt(c.slice(2, 4), 16)) + 0.0722 * f(parseInt(c.slice(4, 6), 16));
  return 1.05 / (L + 0.05);
}

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
    theme: settings.theme ?? "default",
    site_primary: settings.site_primary ?? "",
    site_font: settings.site_font ?? "cairo",
    site_sections: settings.site_sections ?? [],
    site_custom_css: settings.site_custom_css ?? "",
    site_custom_js: settings.site_custom_js ?? "",
    site_accent: settings.site_accent ?? "",
    site_logo: settings.site_logo ?? "",
    site_title: settings.site_title ?? "",
    site_desc: settings.site_desc ?? "",
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
  // ثيم صفحة المعلم العامة: default | dark | minimal | emerald | royal | sunset
  if (typeof body.theme !== "undefined" || typeof body.site_primary !== "undefined" || typeof body.site_font !== "undefined" || typeof body.site_sections !== "undefined" || typeof body.site_custom_css !== "undefined" || typeof body.site_custom_js !== "undefined" || typeof body.site_accent !== "undefined" || typeof body.site_logo !== "undefined" || typeof body.site_title !== "undefined" || typeof body.site_desc !== "undefined") {
    const admin0 = adminClient();
    const { data: plat } = await admin0.from("platform_settings").select("value").eq("key", "design").single();
    const { data: tplan } = await admin0.from("tenants").select("plan").eq("id", res.ctx.tenantId).single();
    // القفل: زر المالك، أو خطة basic افتراضياً (التخصيص الكامل لـ pro+ — قرار المجلس)
    const locked = !!((plat as any)?.value?.lock_tenant_design) || (tplan as any)?.plan === "basic";
    if (locked) {
      return NextResponse.json({ ok: false, error: "locked", message: "التخصيص الكامل لباقات Pro — راسلنا للترقية" }, { status: 403 });
    }
  }
  if (typeof body.theme !== "undefined") {
    const th = String(body.theme ?? "");
    if (!["default", "dark", "minimal", "emerald", "royal", "sunset", "warm", "vibrant"].includes(th)) {
      return NextResponse.json({ ok: false, error: "bad_theme" }, { status: 400 });
    }
    patch.theme = th;
  }
  // اللون الأساسي لموقع السنتر (#RRGGBB) — فارغ = لون الثيم
  if (typeof body.site_primary !== "undefined") {
    const sp = String(body.site_primary ?? "").trim();
    if (sp && !/^#[0-9a-fA-F]{6}$/.test(sp)) {
      return NextResponse.json({ ok: false, error: "bad_color" }, { status: 400 });
    }
    if (sp && contrastWhite(sp) < 3) {
      return NextResponse.json({ ok: false, error: "low_contrast", message: "اللون فاتح — النص به لن يُقرأ. اختر لوناً أغمق." }, { status: 400 });
    }
    patch.site_primary = sp || null;
  }
  // أقسام الموقع + CSS/JS مخصص — بتنقية صارمة (page-builder)
  if (typeof body.site_sections !== "undefined") {
    const { sanitizeSections } = await import("@/lib/site-sections");
    patch.site_sections = sanitizeSections(body.site_sections);
  }
  if (typeof body.site_custom_css !== "undefined") {
    const { sanitizeCss } = await import("@/lib/site-sections");
    patch.site_custom_css = sanitizeCss(body.site_custom_css) || null;
  }
  if (typeof body.site_custom_js !== "undefined") {
    const { sanitizeJs } = await import("@/lib/site-sections");
    patch.site_custom_js = sanitizeJs(body.site_custom_js) || null;
  }
  if (typeof body.site_font !== "undefined") {
    const f = String(body.site_font ?? "");
    if (!["cairo", "readex", "plex"].includes(f)) {
      return NextResponse.json({ ok: false, error: "bad_font" }, { status: 400 });
    }
    patch.site_font = f;
  }
  // اللون الثانوي + الشعار + SEO (قرار المجلس)
  if (typeof body.site_accent !== "undefined") {
    const ac = String(body.site_accent ?? "").trim();
    if (ac && !/^#[0-9a-fA-F]{6}$/.test(ac)) {
      return NextResponse.json({ ok: false, error: "bad_color" }, { status: 400 });
    }
    patch.site_accent = ac || null;
  }
  if (typeof body.site_logo !== "undefined") {
    const lg = String(body.site_logo ?? "").trim().slice(0, 500);
    if (lg && !/^https:\/\//.test(lg)) {
      return NextResponse.json({ ok: false, error: "bad_url", message: "رابط الشعار https فقط" }, { status: 400 });
    }
    patch.site_logo = lg || null;
  }
  if (typeof body.site_title !== "undefined") {
    patch.site_title = String(body.site_title ?? "").trim().slice(0, 80) || null;
  }
  if (typeof body.site_desc !== "undefined") {
    patch.site_desc = String(body.site_desc ?? "").trim().slice(0, 200) || null;
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
