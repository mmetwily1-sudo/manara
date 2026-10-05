import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * بوابة المالك للمسارات الإدارية: platform_admin أو بريد PLATFORM_OWNER_EMAILS.
 * كل فعل إداري يجب أن يسجل في audit_log من المسار المستدعي.
 */
export async function requireOwner(): Promise<{ admin: any; email: string } | { error: ReturnType<typeof NextResponse.json> }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anon || !svc) {
    return { error: NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 }) };
  }
  const store = cookies();
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => { try { store.set(name, value, options); } catch {} }); },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "unauth" }, { status: 401 }) };
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("role").eq("auth_user_id", user.id).single();
  const owners = (process.env.PLATFORM_OWNER_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if ((urow as any)?.role !== "platform_admin" && !owners.includes((user.email ?? "").toLowerCase())) {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { admin, email: user.email ?? "" };
}
