import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/students/register
 * تسجيل طالب جديد في سنتر معين (عبر slug)
 * ينشئ حساب Auth + صف users + يرجع بيانات الدخول
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  const { slug, name, phone, email, password } = body ?? {};

  if (!slug || !name || name.trim().length < 2) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }
  if (!SUPA_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: tenant, error: tErr } = await admin.from("tenants").select("id,name,slug").eq("slug", slug).single();
  if (tErr || !tenant) {
    return NextResponse.json({ ok: false, error: "tenant_not_found" }, { status: 404 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone?.trim() || null;

  // لو الطالب مسجل مسبقاً بنفس الرقم في نفس السنتر بدون حساب دخول → اربط الحساب الجديد بالصف الموجود
  if (cleanPhone) {
    const { data: existing } = await admin
      .from("users")
      .select("id,auth_user_id,full_name")
      .eq("tenant_id", tenant.id)
      .eq("role", "student")
      .eq("phone", cleanPhone)
      .limit(1)
      .single();
    if (existing && !existing.auth_user_id) {
      const { data: au2, error: aue2 } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: name.trim(), role: "student", phone: cleanPhone },
      });
      if (aue2) {
        const isDup = aue2.message?.includes("already registered") || aue2.message?.includes("already exists");
        return NextResponse.json(
          { ok: false, error: isDup ? "email_exists" : "auth_failed", details: aue2.message },
          { status: 400 }
        );
      }
      await admin.from("users").update({ auth_user_id: au2.user.id, full_name: name.trim() }).eq("id", existing.id);
      return NextResponse.json({
        ok: true,
        linked: true,
        student: { email: cleanEmail, tenant: tenant.name, slug: tenant.slug },
      });
    }
  }

  const { data: au, error: aue } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name.trim(), role: "student", phone: cleanPhone ?? "" },
  });

  if (aue) {
    const isDup = aue.message?.includes("already registered") || aue.message?.includes("already exists");
    return NextResponse.json(
      { ok: false, error: isDup ? "email_exists" : "auth_failed", details: aue.message },
      { status: 400 }
    );
  }

  if (!au?.user) {
    return NextResponse.json({ ok: false, error: "auth_failed" }, { status: 500 });
  }

  const { error: uErr } = await admin.from("users").insert({
    tenant_id: tenant.id,
    auth_user_id: au.user.id,
    role: "student",
    full_name: name.trim(),
    phone: cleanPhone,
  });

  if (uErr) {
    await admin.auth.admin.deleteUser(au.user.id);
    const isPhoneDup = uErr.message?.includes("duplicate key") || uErr.message?.includes("users_phone_key");
    return NextResponse.json(
      { ok: false, error: isPhoneDup ? "phone_exists" : "profile_failed", details: uErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    student: { email: cleanEmail, tenant: tenant.name, slug: tenant.slug },
  });
}
