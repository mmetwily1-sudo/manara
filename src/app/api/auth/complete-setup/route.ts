import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, adminClient } from "@/lib/server-auth";

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

/**
 * POST /api/auth/complete-setup
 * للمستخدم المسجل دخوله الذي لا يملك صف users (حساب يتيم):
 * ينشئ سنتراً جديداً ويربطه به — دون الحاجة لإعادة التسجيل.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const { data: existing } = await admin
    .from("users")
    .select("id,tenant_id")
    .eq("auth_user_id", user.id)
    .maybeSingle() as { data: { id: string; tenant_id: string } | null };
  if (existing?.tenant_id) {
    return NextResponse.json({ ok: true, already: true });
  }

  const body = await req.json().catch(() => null as any);
  const centerName = (body?.centerName ?? "").trim();
  const phone = (body?.phone ?? "").replace(/[^\d+]/g, "");
  if (centerName.length < 2 || phone.length < 8) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = makeSlug(centerName);
    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .insert({
        name: centerName,
        slug,
        plan: "trial",
        status: "active",
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        settings: { owner_phone: phone, owner_auth_id: user.id },
      })
      .select("id,slug")
      .single();
    if (tErr || !tenant) {
      const code = (tErr as any)?.code;
      if (code === "23505") continue; // تكرار slug — حاول مجدداً
      return NextResponse.json({ ok: false, error: "tenant_failed" }, { status: 500 });
    }

    const meta = (user.user_metadata ?? {}) as any;
    const { data: userRow, error: uErr } = await admin.from("users").insert({
      tenant_id: (tenant as any).id,
      auth_user_id: user.id,
      role: "teacher_admin",
      full_name: centerName,
      phone,
    }).select("id").single() as { data: { id: string } | null; error: any };

    if (uErr || !userRow) {
      await admin.from("tenants").delete().eq("id", (tenant as any).id);
      const isPhoneDup = (uErr?.message ?? "").includes("duplicate key");
      return NextResponse.json(
        { ok: false, error: isPhoneDup ? "phone_exists" : "profile_failed", details: uErr?.message },
        { status: 400 }
      );
    }

    await admin.from("tenants").update({
      owner_user_id: userRow.id,
      settings: { owner_phone: phone, owner_auth_id: user.id },
    }).eq("id", (tenant as any).id);

    return NextResponse.json({ ok: true, slug: (tenant as any).slug });
  }

  return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
}
