import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/students/phone-code { slug, phone }
 * دخول بدون باسورد: رمز واتساب على رقم الهاتف المسجل، ثم تبادل بجلسة.
 */
export async function POST(req: Request) {
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "phone-code", 5)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }
  if (!SUPA_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }
  const body = await req.json().catch(() => null as any);
  const { slug, phone } = body ?? {};
  if (!slug || !phone) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: tenant } = await admin.from("tenants").select("id,name").eq("slug", slug).single();
  if (!tenant) return NextResponse.json({ ok: false, error: "tenant_not_found" }, { status: 404 });

  const { normalizePhone, sendWhatsAppText, isWhatsAppLive } = await import("@/lib/whatsapp");
  const target = normalizePhone(String(phone));
  if (!target) return NextResponse.json({ ok: false, error: "bad_phone" }, { status: 400 });

  // المستخدم بهذا الرقم في نفس السنتر (أي دور: طالب أو معلم)
  const { data: users } = await admin.from("users").select("id,phone").eq("tenant_id", (tenant as any).id).limit(200);
  const match = ((users ?? []) as any[]).find((u) => normalizePhone(String(u.phone ?? "")) === target);
  if (!match) {
    return NextResponse.json({ ok: false, error: "not_registered", message: "هذا الرقم غير مسجل — سجّل أولاً." }, { status: 404 });
  }

  const { createOtp } = await import("@/lib/otp");
  const made = await createOtp(admin, (tenant as any).id, target, "login");
  if ("error" in made) {
    return NextResponse.json({
      ok: false,
      error: made.error === "cooldown" ? "cooldown" : "otp_failed",
      message: made.error === "cooldown" ? "انتظر دقيقة قبل طلب رمز جديد." : "تعذر إنشاء الرمز.",
    }, { status: 400 });
  }
  let sent = false;
  if (isWhatsAppLive()) {
    const r = await sendWhatsAppText(target, `رمز دخول ${(tenant as any).name} 🔑\n${made.code}\nصالح لعدة دقائق — لا تشاركه مع أحد.`);
    sent = r.ok;
  } else {
    console.log(`[otp-login] ${(tenant as any).id} ${target} code (no WA configured — dev only)`);
  }
  const masked = target.slice(0, 5) + "****" + target.slice(-2);
  return NextResponse.json({ ok: true, sent, masked_phone: masked });
}
