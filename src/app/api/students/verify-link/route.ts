import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rate-limit";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ERR_AR: Record<string, string> = {
  bad_code: "الرمز يجب أن يكون 6 أرقام.",
  no_code: "لا يوجد رمز مرسل لهذا الرقم — اطلب رمزاً جديداً.",
  expired: "انتهت صلاحية الرمز — اطلب رمزاً جديداً.",
  locked: "تجاوزت المحاولات المسموحة — اطلب رمزاً جديداً.",
  wrong_code: "الرمز غير صحيح — تحقق وحاول مجدداً.",
};

/**
 * POST /api/students/verify-link
 * إتمام ربط صف طالب موجود برقم هاتفه بعد إثبات الملكية برمز واتساب.
 * { slug, phone, code, name, email, password }
 */
export async function POST(req: Request) {
  if (isRateLimited(req, "verify-link", 20)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }
  if (!SUPA_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null as any);
  const { slug, phone, code, name, email, password } = body ?? {};
  if (!slug || !phone || !code) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!name || String(name).trim().length < 2) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  if (!cleanEmail.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!password || String(password).length < 6) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }

  const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: tenant } = await admin.from("tenants").select("id,name,slug").eq("slug", slug).single();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "tenant_not_found" }, { status: 404 });
  }

  const { normalizePhone } = await import("@/lib/whatsapp");
  const normalized = normalizePhone(String(phone));
  if (!normalized) {
    return NextResponse.json({ ok: false, error: "bad_phone" }, { status: 400 });
  }

  // 1) التحقق من الرمز أولاً — قبل أي إنشاء
  const { verifyOtp } = await import("@/lib/otp");
  const v = await verifyOtp(admin, tenant.id, normalized, "link_student", String(code));
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: v.error, message: ERR_AR[v.error] ?? "فشل التحقق" },
      { status: 400 }
    );
  }

  // 2) الصف ما زال موجوداً وغير مربوط؟ (حماية من السباق)
  const cleanPhone = String(phone).trim();
  const { data: existing } = await admin
    .from("users")
    .select("id,auth_user_id,phone")
    .eq("tenant_id", tenant.id)
    .eq("role", "student")
    .or(`phone.eq.${cleanPhone},phone.eq.${normalized}`)
    .is("auth_user_id", null)
    .limit(1)
    .single();
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "already_linked", message: "هذا الرقم مربوط بحساب بالفعل." },
      { status: 400 }
    );
  }

  // 3) إنشاء حساب الدخول وربطه
  const { data: au, error: aue } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: String(password),
    email_confirm: true,
    user_metadata: { full_name: String(name).trim(), role: "student", phone: cleanPhone },
  });
  if (aue || !au?.user) {
    const isDup = aue?.message?.includes("already registered") || aue?.message?.includes("already exists");
    return NextResponse.json(
      { ok: false, error: isDup ? "email_exists" : "auth_failed", details: aue?.message },
      { status: 400 }
    );
  }
  await admin
    .from("users")
    .update({
      auth_user_id: au.user.id,
      full_name: String(name).trim(),
      phone_verified_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  return NextResponse.json({
    ok: true,
    linked: true,
    student: { email: cleanEmail, tenant: tenant.name, slug: tenant.slug },
  });
}
