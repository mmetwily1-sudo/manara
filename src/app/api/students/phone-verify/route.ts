import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/students/phone-verify { slug, phone, code }
 * يتحقق من رمز الواتساب ثم يبادل magic-link بجلسة دخول (كوكيز httpOnly).
 */
export async function POST(req: Request) {
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "phone-verify", 10)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }
  if (!SUPA_URL || !ANON || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }
  const body = await req.json().catch(() => null as any);
  const { slug, phone, code } = body ?? {};
  if (!slug || !phone || !code) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: tenant } = await admin.from("tenants").select("id").eq("slug", slug).single();
  if (!tenant) return NextResponse.json({ ok: false, error: "tenant_not_found" }, { status: 404 });
  const tid = (tenant as any).id;

  const { normalizePhone } = await import("@/lib/whatsapp");
  const target = normalizePhone(String(phone));
  if (!target) return NextResponse.json({ ok: false, error: "bad_phone" }, { status: 400 });

  const { verifyOtp } = await import("@/lib/otp");
  const v = await verifyOtp(admin, tid, target, "login", String(code));
  if (!v.ok) {
    const msg = v.error === "bad_code" ? "الرمز غير صحيح." : v.error === "expired" ? "انتهت صلاحية الرمز — اطلب جديداً." : "تحقق كثير — اطلب رمزاً جديداً.";
    return NextResponse.json({ ok: false, error: v.error, message: msg }, { status: 400 });
  }

  const { data: users } = await admin.from("users").select("id,auth_user_id,role,full_name,phone").eq("tenant_id", tid).limit(500);
  const match = ((users ?? []) as any[]).find((u) => normalizePhone(String(u.phone ?? "")) === target);
  if (!match?.auth_user_id) return NextResponse.json({ ok: false, error: "not_registered" }, { status: 404 });

  // بريد الحساب من Auth ثم magic-link يُبادل بجلسة على عميل مربوط بكوكيز الرد
  const { data: au } = await admin.auth.admin.getUserById(match.auth_user_id);
  const email = au?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const emailOtp = (link as any)?.properties?.email_otp;
  if (linkErr || !emailOtp) return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });

  const res = NextResponse.json({
    ok: true,
    role: match.role,
    redirect: match.role === "teacher_admin" ? "/dashboard" : "/progress",
  });
  const { cookies } = await import("next/headers");
  const store = cookies();
  const supa = createServerClient(SUPA_URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cs: any[]) => { cs.forEach(({ name, value, options }: any) => res.cookies.set(name, value, options)); },
    },
  });
  const { data: sess, error: sessErr } = await supa.auth.verifyOtp({ email, token: String(emailOtp), type: "email" });
  if (sessErr || !sess.session) return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });
  return res;
}
