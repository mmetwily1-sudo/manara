import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/**
 * GET /api/auth/sync — مزامنة/شفاء حساب المستخدم بعد الدخول
 * - لو صف users موجود → يرجع بيانات السنتر
 * - لو مفقود لكن يوجد سنتر مربوط بـ owner_auth_id → ينشئ صف users تلقائياً (شفاء ذاتي)
 * - غير ذلك → no_tenant
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const { data: urow } = await admin
    .from("users")
    .select("id,tenant_id,role")
    .eq("auth_user_id", user.id)
    .single();

  if (urow?.tenant_id) {
    const { data: t } = await admin
      .from("tenants")
      .select("name,slug,plan")
      .eq("id", urow.tenant_id)
      .single();
    return NextResponse.json({ ok: true, healed: false, tenant: t ?? null, role: urow.role });
  }

  // شفاء ذاتي: ابحث عن سنتر يملكه هذا المستخدم عبر settings.owner_auth_id
  const { data: owned } = await admin
    .from("tenants")
    .select("id,name,slug,plan")
    .eq("settings->>owner_auth_id", user.id)
    .limit(1)
    .single();

  if (!owned) {
    return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 404 });
  }

  const meta = (user.user_metadata ?? {}) as any;
  const { data: created, error: cErr } = await admin.from("users").insert({
    tenant_id: owned.id,
    auth_user_id: user.id,
    role: "teacher_admin",
    full_name: meta.full_name ?? owned.name,
    phone: meta.phone ?? null,
  }).select("id").single();

  if (cErr || !created) {
    return NextResponse.json({ ok: false, error: "heal_failed", details: cErr?.message }, { status: 500 });
  }

  await admin.from("tenants").update({ owner_user_id: created.id }).eq("id", owned.id);

  return NextResponse.json({
    ok: true,
    healed: true,
    tenant: { name: owned.name, slug: owned.slug, plan: owned.plan },
    role: "teacher_admin",
  });
}
