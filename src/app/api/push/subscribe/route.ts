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
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 403 });

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
    tenant_id: (urow as any).tenant_id, user_id: (urow as any).id,
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
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 403 });
  const body = await req.json().catch(() => ({} as any));
  const endpoint = String(body?.endpoint ?? "");
  let q = admin.from("push_subscriptions").delete().eq("user_id", (urow as any).id);
  if (endpoint) q = q.eq("endpoint", endpoint);
  await q;
  return NextResponse.json({ ok: true });
}
