import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * POST /api/trial â€” ØªØ³Ø¬ÙŠÙ„ ØªØ¬Ø±Ø¨Ø© Ù…Ø¬Ø§Ù†ÙŠØ© Ø­Ù‚ÙŠÙ‚ÙŠØ©
 *
 * ÙˆØ¶Ø¹Ø§Ù† ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù†:
 * - Ù„Ùˆ Ù…ÙØ§ØªÙŠØ­ Supabase Ù…ÙˆØ¬ÙˆØ¯Ø© â†’ ÙŠÙ†Ø´Ø¦ tenant ÙØ¹Ù„ÙŠ Ø¨Ù€7 Ø£ÙŠØ§Ù… ØªØ¬Ø±Ø¨Ø© ÙˆÙŠØ±Ø¬Ø¹ Ø§Ù„Ù€subdomain
 * - Ù„Ùˆ Ù…Ø´ Ù…ÙˆØ¬ÙˆØ¯Ø© (Ø§Ø³ØªØ¶Ø§ÙØ© Ø«Ø§Ø¨ØªØ©/Ø¥Ø¹Ø¯Ø§Ø¯ Ù†Ø§Ù‚Øµ) â†’ ÙŠØ±Ø¬Ø¹ fallback ÙˆØ§Ù„Ø¹Ù…ÙŠÙ„ ÙŠÙƒÙ…Ù„ ÙˆØ§ØªØ³Ø§Ø¨ Ù…Ø¹ ØªØ£ÙƒÙŠØ¯ Ù…Ø±Ø¦ÙŠ
 */

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  let body: { centerName?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const centerName = (body.centerName ?? "").trim();
  const phone = (body.phone ?? "").replace(/[^\d+]/g, "");

  if (centerName.length < 2 || phone.length < 8) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
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
        settings: { owner_phone: phone },
      })
      .select("id,slug")
      .single();

    if (!error && data) {
      // Ø­Ø³Ø§Ø¨ Ø¯Ø®ÙˆÙ„ ÙØ¹Ù„ÙŠ Ù„Ù„Ù…Ø¹Ù„Ù… (Ø¨Ø¯ÙˆÙ† Ø­Ø§Ø¬Ø© Ù„Ø¥ÙŠÙ…ÙŠÙ„ Ø®Ø§Ø±Ø¬ÙŠ ÙÙŠ Ø§Ù„Ù€MVP)
      const loginEmail = `${data.slug}@manara.app`;
      const password = randomBytes(6).toString("base64url");
      let creds: { email: string; password: string } | null = null;
      try {
        const { data: au, error: aue } = await admin.auth.admin.createUser({
          email: loginEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: centerName, role: "teacher_admin", phone },
        });
        if (!aue && au?.user) {
          creds = { email: loginEmail, password };
          await admin.from("tenants").update({ owner_user_id: au.user.id }).eq("id", data.id);
          await admin.from("users").insert({
            tenant_id: data.id,
            auth_user_id: au.user.id,
            role: "teacher_admin",
            full_name: centerName,
            phone,
          });
        }
      } catch (e) {
        console.error("auth user creation failed:", e);
      }

      return NextResponse.json({
        ok: true,
        mode: "live",
        slug: data.slug,
        creds,
      });
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


