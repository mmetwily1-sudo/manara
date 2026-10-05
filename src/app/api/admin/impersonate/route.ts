import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";

/**
 * GET /api/admin/impersonate?student_id=...&to=parent|progress
 * دخول المالك بعين طالب/ولي أمر للمتابعة (مسجل في audit_log — لا يستخدم إلا للمتابعة).
 * المالك: platform_admin أو بريد PLATFORM_OWNER_EMAILS.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const base = `${u.protocol}//${u.host}`;
  const studentId = u.searchParams.get("student_id") ?? "";
  const to = u.searchParams.get("to") === "progress" ? "/progress" : "/parent";
  if (!studentId) return NextResponse.json({ ok: false, error: "student_required" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !anon || !svc) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });

  const store = cookies();
  const sb = createServerClient(url, anon, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => { try { store.set(name, value, options); } catch {} }); } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const owners = (process.env.PLATFORM_OWNER_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const { data: urow } = await admin.from("users").select("role").eq("auth_user_id", user.id).single();
  if ((urow as any)?.role !== "platform_admin" && !owners.includes((user.email ?? "").toLowerCase())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: st } = await admin.from("users").select("id,tenant_id,full_name").eq("id", studentId).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const tid = (st as any).tenant_id as string;

  // جلسة ولي الأمر + جلسة الطالب معاً
  const ptoken = randomBytes(24).toString("base64url");
  const phash = createHash("sha256").update("parent:" + ptoken).digest("hex");
  const stoken = randomBytes(24).toString("base64url");
  const shash = createHash("sha256").update("student:" + stoken).digest("hex");
  const expires = new Date(Date.now() + 24 * 3600e3).toISOString(); // 24 ساعة فقط للمتابعة
  await admin.from("parent_portal_sessions").insert({ tenant_id: tid, parent_id: (st as any).id, student_id: (st as any).id, token_hash: phash, expires_at: expires });
  await admin.from("student_sessions").insert({ tenant_id: tid, student_id: (st as any).id, token_hash: shash, expires_at: expires });
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: (st as any).id, action: "owner:impersonate", entity_type: "student", entity_id: (st as any).id,
      details: { by: user.email, to },
    });
  } catch {}

  const secure = u.protocol === "https:";
  const res = NextResponse.redirect(`${base}${to}`, 302);
  res.cookies.set("manara_parent_token", ptoken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 86400 });
  res.cookies.set("manara_student_token", stoken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 86400 });
  return res;
}
