import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { dbFail } from "@/lib/api-error";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** POST /api/push/subscribe {subscription:{endpoint,keys:{p256dh,auth}}} — أي مستخدم مسجل (معلم/طالب/ولي أمر بنفس الحساب) */
export async function POST(req: Request) {
  if (!SUPA_URL || !ANON) return NextResponse.json({ ok: false, error: "no_backend" }, { status: 500 });
  const store = cookies();
  const sbUser = createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
  const { data: { user } } = await sbUser.auth.getUser();
  let tenantId: string | null = null;
  let userId: string | null = null;
  if (user) {
    const admin0 = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: urow0 } = await admin0.from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
    if (!urow0) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 403 });
    tenantId = (urow0 as any).tenant_id;
    userId = (urow0 as any).id;
  } else {
    // ولي الأمر بالرابط السحري (بلا حساب): كوكيز البوابة → طالب
    const { createHash } = await import("node:crypto");
    const ptoken = (req.headers.get("x-parent-token") ?? store.get("manara_parent_token")?.value) ?? "";
    if (!ptoken) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    const admin0 = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const th = createHash("sha256").update("parent:" + ptoken).digest("hex");
    const { data: sess } = await admin0.from("parent_portal_sessions").select("student_id,tenant_id,expires_at")
      .eq("token_hash", th).limit(1).single();
    if (!sess || new Date((sess as any).expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
    }
    tenantId = (sess as any).tenant_id;
    userId = (sess as any).student_id;
  }

  const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({} as any));
  const sub = body?.subscription ?? {};
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!endpoint || !p256dh || !auth || endpoint.length > 2000) {
    return NextResponse.json({ ok: false, error: "bad_subscription" }, { status: 400 });
  }

  // endpoint فريد عالمياً: إعادة الاشتراك تُحدّث المالك بدل التكرار
  const { error } = await admin.from("push_subscriptions").upsert({
    tenant_id: tenantId, user_id: userId,
    endpoint, p256dh, auth, last_seen_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return dbFail("push-subscribe", error);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe {endpoint?} — إلغاء اشتراك هذا الجهاز (أو كل أجهزتي) */
export async function DELETE(req: Request) {
  if (!SUPA_URL || !ANON) return NextResponse.json({ ok: false, error: "no_backend" }, { status: 500 });
  const store = cookies();
  const sbUser = createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
  const { data: { user } } = await sbUser.auth.getUser();
  let delUserId: string | null = null;
  if (user) {
    const admin0 = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: urow0 } = await admin0.from("users").select("id").eq("auth_user_id", user.id).single();
    if (!urow0) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 403 });
    delUserId = (urow0 as any).id;
  } else {
    const { createHash } = await import("node:crypto");
    const ptoken = (req.headers.get("x-parent-token") ?? store.get("manara_parent_token")?.value) ?? "";
    if (!ptoken) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    const admin0 = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const th = createHash("sha256").update("parent:" + ptoken).digest("hex");
    const { data: sess } = await admin0.from("parent_portal_sessions").select("student_id,expires_at")
      .eq("token_hash", th).limit(1).single();
    if (!sess || new Date((sess as any).expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
    }
    delUserId = (sess as any).student_id;
  }
  const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({} as any));
  const endpoint = String(body?.endpoint ?? "");
  let q = admin.from("push_subscriptions").delete().eq("user_id", delUserId);
  if (endpoint) q = q.eq("endpoint", endpoint);
  await q;
  return NextResponse.json({ ok: true });
}
