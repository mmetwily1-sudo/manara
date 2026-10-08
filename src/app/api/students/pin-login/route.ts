import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPin, makeSessionToken } from "@/lib/student-auth";
import { toAsciiDigits, normalizePhone } from "@/lib/whatsapp";
import { arError } from "@/lib/auth-errors";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/students/pin-login { slug, phone, pin }
 * دخول الطالب برقم الهاتف + PIN — جلسة httpOnly سنة (للأونلاين والتقدم).
 */
export async function POST(req: Request) {
  const { isRateLimited, pinLoginRateOk } = await import("@/lib/rate-limit");
  if (await isRateLimited(req, "pin-login", 10)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts", message: arError("too_many_attempts") }, { status: 429 });
  }
  if (!SUPA_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "not_configured", message: arError("not_configured") }, { status: 500 });
  }
  const body = await req.json().catch(() => ({} as any));
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const pin = toAsciiDigits(String(body?.pin ?? "")).replace(/[^\d]/g, "").slice(0, 6);
  const phone = normalizePhone(toAsciiDigits(String(body?.phone ?? "")));
  if (!slug || !phone || pin.length !== 6) {
    return NextResponse.json({ ok: false, error: "invalid_input", message: "رقم الموبايل (11 رقم) + PIN من 6 أرقام" }, { status: 400 });
  }
  if (!pinLoginRateOk(req, slug, phone)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts", message: "محاولات كثيرة — انتظر 15 دقيقة" }, { status: 429 });
  }
  const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: tenant } = await admin.from("tenants").select("id").eq("slug", slug).single();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "tenant_not_found", message: arError("tenant_not_found") }, { status: 404 });
  }
  const tid = (tenant as any).id as string;
  const { data: tn } = await admin.from("tenants").select("status").eq("id", tid).single();
  if ((tn as any)?.status && (tn as any).status !== "active") {
    return NextResponse.json({ ok: false, error: "tenant_suspended", message: "حساب السنتر موقوف مؤقتاً — تواصل مع الإدارة" }, { status: 403 });
  }
  const { data: users } = await admin.from("users").select("id,phone,pin_hash").eq("tenant_id", tid).eq("role", "student").limit(500);
  const match = ((users ?? []) as any[]).find((u) => normalizePhone(String(u.phone ?? "")) === phone);
  if (!match?.pin_hash) {
    return NextResponse.json({ ok: false, error: "not_registered", message: "هذا الرقم غير مسجل أو بلا PIN — اطلبه من إدارة السنتر" }, { status: 404 });
  }
  if ((match as any).pin_hash !== hashPin(pin, tid)) {
    return NextResponse.json({ ok: false, error: "bad_pin", message: "الـ PIN غير صحيح — تأكد وحاول تاني" }, { status: 401 });
  }
  const { token, hash } = makeSessionToken();
  const expires = new Date(Date.now() + 365 * 864e5).toISOString();
  await admin.from("student_sessions").insert({ tenant_id: tid, student_id: (match as any).id, token_hash: hash, expires_at: expires });
  const res = NextResponse.json({ ok: true, redirect: "/progress" });
  const u = new URL(req.url);
  res.cookies.set("manara_student_token", token, {
    httpOnly: true, secure: u.protocol === "https:", sameSite: "lax", path: "/", maxAge: 365 * 86400,
  });
  return res;
}
