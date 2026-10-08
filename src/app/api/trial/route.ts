import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { arError } from "@/lib/auth-errors";

/** رد خطأ موحد: كود للآلة + رسالة عربية للإنسان — لا إنجليزية أبداً */
function fail(error: string, status: number, message?: string) {
  return NextResponse.json({ ok: false, error, message: message ?? arError(error) }, { status });
}

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
    return NextResponse.json({ ok: false, error: "already_have_account", message: arError("already_have_account") }, { status: 400 });
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
      { ok: false, error: isPhoneDup ? "phone_exists" : "profile_failed", message: arError(isPhoneDup ? "phone_exists" : "profile_failed") },
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

  // لا نرجع كلمة السر أبداً — العميل يملكها في ذاكرته للدخول التلقائي
  return NextResponse.json({
    ok: true,
    mode: "live",
    slug,
    email,
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

/** محتوى تجريبي لسنتر الجولة الفورية — أسئلة معتمدة + امتحان منشور. يعيد إحصاء ما زُرع. */
async function seedDemo(admin: any, tenantId: string): Promise<{ questions: number; links: number; step: string }> {
  const stat = { questions: 0, links: 0, step: "start" };
  try {
    const qs = [
      { subject: "علوم", body: "ما الغاز الذي نتنفسه للبقاء على قيد الحياة؟", options: ["الأكسجين", "ثاني أكسيد الكربون", "الهيليوم"], correct_answer: "الأكسجين", difficulty: 1 },
      { subject: "علوم", body: "كم عدد كواكب المجموعة الشمسية؟", options: ["سبعة", "ثمانية", "تسعة"], correct_answer: "ثمانية", difficulty: 1 },
      { subject: "رياضيات", body: "ما ناتج 7 × 8؟", options: ["54", "56", "63"], correct_answer: "56", difficulty: 2 },
      { subject: "رياضيات", body: "ما العدد الأولي فيما يلي؟", options: ["9", "13", "15"], correct_answer: "13", difficulty: 2 },
      { subject: "لغة عربية", body: "ما جمع كلمة «كتاب»؟", options: ["كتب", "كاتبون", "مكتبات"], correct_answer: "كتب", difficulty: 1 },
    ];
    const rows = qs.map((q) => ({
      tenant_id: tenantId, subject: q.subject, qtype: "mcq", body: q.body,
      options: q.options, correct_answer: q.correct_answer, difficulty: q.difficulty,
      visibility: "private", status: "approved", source: "teacher",
      source_detail: JSON.stringify({ demo: true }), marks: 1,
    }));
    const qi = await admin.from("questions").insert(rows).select("id");
    if (qi.error) { stat.step = "q:" + String(qi.error.message).slice(0, 60); return stat; }
    const inserted = (qi.data ?? []) as any[];
    stat.questions = inserted.length;
    stat.step = "questions-ok";
    const { data: ex } = await admin.from("exams").insert({
      tenant_id: tenantId, title: "امتحان تجريبي — علوم ورياضيات",
      duration_minutes: 15, total_marks: inserted.length || 0, is_published: true,
    }).select("id").single();
    if (ex && inserted.length) {
      let pos = 0;
      for (const q of inserted) {
        const li = await admin.from("exam_questions").insert({
          tenant_id: tenantId, exam_id: (ex as any).id, question_id: q.id, position: pos++, marks: 1,
        });
        if (li.error) { stat.step = "link:" + String(li.error.message).slice(0, 60); break; }
        stat.links++;
      }
      stat.step = "done";
    }
    const { data: trow } = await admin.from("tenants").select("settings").eq("id", tenantId).single();
    await admin.from("tenants").update({ settings: { ...((trow as any)?.settings ?? {}), is_demo: true } }).eq("id", tenantId);
  } catch (e: any) {
    stat.step = "throw:" + String(e?.message ?? e).slice(0, 60);
  }
  return stat;
}

export async function POST(req: Request) {
  const { isRateLimited } = await import("@/lib/rate-limit");
  let preBody: any = null;
  try { preBody = await req.json(); } catch {
    return fail("bad_json", 400);
  }
  const body = preBody;
  // الجولة الفورية: حد مستقل 3/ساعة لكل IP (حسابات مؤقتة بأسماء عشوائية)
  const isDemo = body.demo === true;
  if (isDemo && await isRateLimited(req, "trial-demo", 3)) {
    return fail("too_many_attempts", 429, "جولات كثيرة — انتظر ساعة.");
  }
  // حد: 5 محاولات/ساعة لكل IP ضد إغراق إنشاء السناتر
  if (!isDemo && await isRateLimited(req, "trial", 5)) {
    return fail("too_many_attempts", 429);
  }

  // تحقق بشري (Cloudflare Turnstile) — يُفعَّل بإضافة المفاتيح في البيئة
  const { verifyCaptcha, captchaRequired } = await import("@/lib/captcha");
  if (captchaRequired()) {
    const fwd = req.headers.get("x-forwarded-for");
    const okHuman = await verifyCaptcha(body.captchaToken, fwd?.split(",")[0]?.trim());
    if (!okHuman) {
      return NextResponse.json({ ok: false, error: "captcha_required", message: "تحقق أنك لست روبوتاً ثم أعد المحاولة." }, { status: 403 });
    }
  }

  const centerName = (body.centerName ?? "").trim();
  const { toAsciiDigits } = await import("@/lib/whatsapp");
  const phone = toAsciiDigits(body.phone ?? "").replace(/[^\d+]/g, "");
  const emailInput = (body.email ?? "").trim().toLowerCase();
  const passwordInput = (body.password ?? "").trim();

  if (centerName.length < 2 || phone.length < 8) {
    return fail("invalid_input", 400);
  }
  if (!emailInput || !emailInput.includes("@")) {
    return fail("invalid_credentials", 400);
  }
  const { checkPassword, WEAK_PASSWORD } = await import("@/lib/password");
  const pwErr = checkPassword(passwordInput);
  if (pwErr) {
    return fail(WEAK_PASSWORD, 400, pwErr);
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
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
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
            return fail("email_exists", 400);
          }
          await admin.from("tenants").delete().eq("id", data.id);
          const { logError } = await import("@/lib/api-error");
          logError("trial-auth", aue);
          return fail("auth_failed", 400);
        }
        if (!au?.user) {
          await admin.from("tenants").delete().eq("id", data.id);
          return fail("auth_failed", 500);
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
          const { logError } = await import("@/lib/api-error");
          logError("trial-profile", uErr);
          return fail(isPhoneDup ? "phone_exists" : "profile_failed", 400);
        }
        // ربط المالك بصف users (وليس auth id — القيد fk_owner يشير لـ users.id)
        // + حفظ owner_auth_id في settings للشفاء الذاتي لاحقاً
        await admin.from("tenants").update({
          owner_user_id: userRow.id,
          settings: { owner_phone: phone, owner_auth_id: au.user.id },
        }).eq("id", data.id);

        // الإحالة: اربط السنتر الجديد بكود الداعي (pending — لا مكافأة قبل أول دفعة)
        let referredBy: string | undefined;
        const refCode = String(body.ref ?? "").trim().toUpperCase().slice(0, 24);
        if (refCode && !isDemo) {
          try {
            const { data: refRow } = await admin.from("referrals").select("referrer_tenant_id")
              .eq("code", refCode).is("referee_tenant_id", null).limit(1).single();
            const rid = (refRow as any)?.referrer_tenant_id as string | undefined;
            if (rid && rid !== data.id) {
              const { phoneHash } = await import("@/lib/referral");
              const { error: refErr } = await admin.from("referrals").insert({
                referrer_tenant_id: rid, code: refCode,
                referee_tenant_id: data.id, referee_phone_hash: phoneHash(phone),
              });
              if (!refErr) referredBy = refCode;
            }
          } catch {}
        }

        // الجولة الفورية: ازرع محتوى تجريبياً وعلّم السنتر كتجريبي
        let seed: { questions: number; links: number; step: string } | undefined;
        if (isDemo) seed = await seedDemo(admin, data.id);

        return NextResponse.json({
          ok: true,
          mode: "live",
          slug: data.slug,
          email: loginEmail,
          demo: isDemo || undefined,
          seed,
          referredBy,
        });
      } catch (e: any) {
        console.error("trial failed:", e?.message);
        await admin.from("tenants").delete().eq("id", data.id);
        return fail("server_error", 500);
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


