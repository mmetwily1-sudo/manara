import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rate-limit";

/**
 * POST /api/trial â€” ØªØ³Ø¬ÙŠÙ„ ØªØ¬Ø±Ø¨Ø© Ù…Ø¬Ø§Ù†ÙŠØ© Ø­Ù‚ÙŠÙ‚ÙŠØ©
 *
 * ÙˆØ¶Ø¹Ø§Ù† ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù†:
 * - Ù„Ùˆ Ù…ÙØ§ØªÙŠØ­ Supabase Ù…ÙˆØ¬ÙˆØ¯Ø© â†’ ÙŠÙ†Ø´Ø¦ tenant ÙØ¹Ù„ÙŠ Ø¨Ù€7 Ø£ÙŠØ§Ù… ØªØ¬Ø±Ø¨Ø© ÙˆÙŠØ±Ø¬Ø¹ Ø§Ù„Ù€subdomain
 * - Ù„Ùˆ Ù…Ø´ Ù…ÙˆØ¬ÙˆØ¯Ø© (Ø§Ø³ØªØ¶Ø§ÙØ© Ø«Ø§Ø¨ØªØ©/Ø¥Ø¹Ø¯Ø§Ø¯ Ù†Ø§Ù‚Øµ) â†’ ÙŠØ±Ø¬Ø¹ fallback ÙˆØ§Ù„Ø¹Ù…ÙŠÙ„ ÙŠÙƒÙ…Ù„ ÙˆØ§ØªØ³Ø§Ø¨ Ù…Ø¹ ØªØ£ÙƒÙŠØ¯ Ù…Ø±Ø¦ÙŠ
 */

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * إكمال الإعداد لحساب auth موجود مسبقاً (يتيم بدون صف users).
 * يثبت الملكية بتسجيل الدخول بكلمة السر المُدخلة، ثم يربط الحساب بالسنتر الجديد.
 * يرجع Response جاهزاً عند النجاح/الحساب المكتمل، أو null عند فشل إثبات الملكية.
 */
async function completeSetupForExistingAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  email: string,
  password: string,
  tenantId: string,
  slug: string,
  centerName: string,
  phone: string
): Promise<ReturnType<typeof NextResponse.json> | null> {
  if (!SUPA_URL || !SUPA_ANON) return null;
  const anon = createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } });
  const { data: sess, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !sess.session) return null; // ليست كلمة سره → بريد يخص شخصاً آخر
  const uid = sess.session.user.id;

  const { data: existingRow } = await admin.from("users").select("id,tenant_id").eq("auth_user_id", uid).maybeSingle();
  const existing = existingRow as { id: string; tenant_id: string } | null;
  if (existing?.tenant_id) {
    await admin.from("tenants").delete().eq("id", tenantId);
    return NextResponse.json({ ok: false, error: "already_have_account" }, { status: 400 });
  }

  const { data: userRow, error: uErr } = await admin.from("users").insert({
    tenant_id: tenantId,
    auth_user_id: uid,
    role: "teacher_admin",
    full_name: centerName,
    phone,
  }).select("id").single();
  if (uErr || !userRow) {
    await admin.from("tenants").delete().eq("id", tenantId);
    const isPhoneDup = uErr?.message?.includes("users_phone_key") || uErr?.message?.includes("duplicate key");
    return NextResponse.json(
      { ok: false, error: isPhoneDup ? "phone_exists" : "profile_failed", details: uErr?.message },
      { status: 400 }
    );
  }

  await admin.from("tenants").update({
    owner_user_id: userRow.id,
    settings: { owner_phone: phone, owner_auth_id: uid },
  }).eq("id", tenantId);
  await admin.auth.admin.updateUserById(uid, {
    user_metadata: { full_name: centerName, role: "teacher_admin", phone },
  });

  return NextResponse.json({
    ok: true,
    mode: "live",
    slug,
    creds: { email, password },
  });
}

function makeSlug(centerName: string): string {
  const latin = centerName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 20);
  const rand = Math.random().toString(36).slice(2, 6);
  return latin.length >= 3 ? `${latin}-${rand}` : `mr-${rand}`;
}

export async function POST(req: Request) {
  // حد: 5 محاولات/ساعة لكل IP ضد إغراق إنشاء السناتر
  if (isRateLimited(req, "trial", 5)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }

  let body: { centerName?: string; phone?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const centerName = (body.centerName ?? "").trim();
  const phone = (body.phone ?? "").replace(/[^\d+]/g, "");
  const emailInput = (body.email ?? "").trim().toLowerCase();
  const passwordInput = (body.password ?? "").trim();

  if (centerName.length < 2 || phone.length < 8) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 }
    );
  }
  if (!emailInput || !emailInput.includes("@") || passwordInput.length < 6) {
    return NextResponse.json(
      { ok: false, error: "invalid_credentials" },
      { status: 400 }
    );
  }

  // ÙˆØ¶Ø¹ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø©/Ø§Ù„Ø§Ø³ØªØ¶Ø§ÙØ© Ø§Ù„Ø«Ø§Ø¨ØªØ© â€” Ø¨Ø¯ÙˆÙ† Ù…ÙØ§ØªÙŠØ­
  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ ok: true, mode: "fallback" });
  }

  // Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ â€” Ø¥Ù†Ø´Ø§Ø¡ Ø³Ù†ØªØ± Ø§Ù„ØªØ¬Ø±Ø¨Ø© ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª
  const admin = createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = makeSlug(centerName);
    const { data, error } = await admin
      .from("tenants")
      .insert({
        name: centerName,
        slug,
        plan: "trial",
        status: "active",
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        settings: { owner_phone: phone, owner_auth_id: null },
      })
      .select("id,slug")
      .single();

    if (!error && data) {
      const loginEmail = emailInput;
      const password = passwordInput;
      try {
        const { data: au, error: aue } = await admin.auth.admin.createUser({
          email: loginEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: centerName, role: "teacher_admin", phone },
        });
        if (aue) {
          const isDuplicate = (aue.message ?? "").toLowerCase().includes("already");
          if (isDuplicate) {
            // البريد مسجل من قبل — تحقق من الملكية بتسجيل الدخول بنفس كلمة السر
            const owned = await completeSetupForExistingAuth(admin, loginEmail, password, data.id, data.slug, centerName, phone);
            if (owned) return owned;
            await admin.from("tenants").delete().eq("id", data.id);
            return NextResponse.json({ ok: false, error: "email_exists" }, { status: 400 });
          }
          await admin.from("tenants").delete().eq("id", data.id);
          return NextResponse.json(
            { ok: false, error: "auth_failed", details: aue.message },
            { status: 400 }
          );
        }
        if (!au?.user) {
          await admin.from("tenants").delete().eq("id", data.id);
          return NextResponse.json({ ok: false, error: "auth_failed" }, { status: 500 });
        }
        // إنشاء صف المستخدم (مطلوب لسياسات RLS) — أي فشل هنا = إلغاء كل شيء
        const { data: userRow, error: uErr } = await admin.from("users").insert({
          tenant_id: data.id,
          auth_user_id: au.user.id,
          role: "teacher_admin",
          full_name: centerName,
          phone,
        }).select("id").single();
        if (uErr || !userRow) {
          await admin.auth.admin.deleteUser(au.user.id);
          await admin.from("tenants").delete().eq("id", data.id);
          const isPhoneDup = uErr?.message?.includes("users_phone_key") || uErr?.message?.includes("duplicate key");
          return NextResponse.json(
            { ok: false, error: isPhoneDup ? "phone_exists" : "profile_failed", details: uErr?.message },
            { status: 400 }
          );
        }
        // ربط المالك بصف users (وليس auth id — القيد fk_owner يشير لـ users.id)
        // + حفظ owner_auth_id في settings للشفاء الذاتي لاحقاً
        await admin.from("tenants").update({
          owner_user_id: userRow.id,
          settings: { owner_phone: phone, owner_auth_id: au.user.id },
        }).eq("id", data.id);

        return NextResponse.json({
          ok: true,
          mode: "live",
          slug: data.slug,
          creds: { email: loginEmail, password },
        });
      } catch (e: any) {
        console.error("trial failed:", e?.message);
        await admin.from("tenants").delete().eq("id", data.id);
        return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
      }
    }

    const code = (error as unknown as { code?: string })?.code;
    if (code !== "23505") {
      console.error("trial insert failed:", error?.message, error);
      return NextResponse.json({ ok: true, mode: "fallback" });
    }
    // ØªÙƒØ±Ø§Ø± slug â†’ Ù…Ø­Ø§ÙˆÙ„Ø© Ø£Ø®Ø±Ù‰ Ø¨Ù…ÙØªØ§Ø­ Ø¬Ø¯ÙŠØ¯
  }

  return NextResponse.json({ ok: true, mode: "fallback" });
}


