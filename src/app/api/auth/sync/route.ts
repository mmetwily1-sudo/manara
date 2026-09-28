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
    const newDevice = await trackDevice(admin, urow as any);
    return NextResponse.json({ ok: true, healed: false, tenant: t ?? null, role: urow.role, newDevice });
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
  const newDevice = await trackDevice(admin, { ...(created as any), tenant_id: owned.id });

  return NextResponse.json({
    ok: true,
    healed: true,
    tenant: { name: owned.name, slug: owned.slug, plan: owned.plan },
    role: "teacher_admin",
    newDevice,
  });
}

/** تسجيل جهاز الدخول + كشف الغريب (يرجع true عند أول ظهور) */
async function trackDevice(admin: any, urow: { id: string; tenant_id: string }): Promise<boolean> {
  try {
    const { headers } = await import("next/headers");
    const { createHash } = await import("node:crypto");
    const h = headers();
    const ua = h.get("user-agent") ?? "";
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
    const mob = /mobile|android|iphone/i.test(ua);
    const br = /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "متصفح";
    const label = `${mob ? "📱 موبايل" : "💻 كمبيوتر"} · ${br}`.slice(0, 60);
    const ipHash = createHash("sha256").update(`${urow.tenant_id}:${ip}`).digest("hex").slice(0, 32);
    const { data: prev } = await admin.from("login_devices").select("id,revoked")
      .eq("tenant_id", urow.tenant_id).eq("user_id", urow.id).eq("ip_hash", ipHash).eq("device_label", label).limit(1).single();
    if (prev) {
      if ((prev as any).revoked) {
        // جهاز منتهي يحاول الدخول: إنهاء جلساته فوراً
        try {
          const { data: au } = await admin.from("users").select("auth_user_id").eq("id", urow.id).single();
          const auid = (au as any)?.auth_user_id as string | undefined;
          if (auid) await admin.auth.admin.signOut(auid);
        } catch {}
        return false;
      }
      await admin.from("login_devices").update({ last_seen: new Date().toISOString() }).eq("id", (prev as any).id);
      return false;
    }
    await admin.from("login_devices").insert({
      tenant_id: urow.tenant_id, user_id: urow.id, device_label: label, ip_hash: ipHash,
    });
    try {
      await admin.from("audit_log").insert({
        tenant_id: urow.tenant_id, actor_id: urow.id,
        action: "auth:new_device", entity_type: "login_device", entity_id: urow.id,
        details: { label },
      });
    } catch {}
    return true;
  } catch { return false; }
}
