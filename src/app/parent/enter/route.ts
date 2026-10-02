import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

/**
 * GET /parent/enter?token=XYZ — دخول ولي الأمر بالرابط السحري (بلا حساب ولا باسورد).
 * يتحقق من التوكين → يثبت كوكيز httpOnly → يحول للبوابة. الرابط يُشارك مرة واحدة ويعمل سنة.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = (u.searchParams.get("token") ?? "").trim();
  const base = `${u.protocol}//${u.host}`;
  if (!token || token.length < 10) return bad(base, "الرابط ناقص — اطلب رابطاً جديداً من إدارة السنتر.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !svc) return bad(base, "الخدمة غير مهيأة — تواصل مع الإدارة.");
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const tokenHash = createHash("sha256").update("parent:" + token).digest("hex");
  const { data: sess } = await admin.from("parent_portal_sessions").select("id,expires_at")
    .eq("token_hash", tokenHash).limit(1).single();
  if (!sess || new Date((sess as any).expires_at).getTime() < Date.now()) {
    return bad(base, "الرابط منتهي — اطلب رابطاً جديداً من إدارة السنتر.");
  }
  const res = NextResponse.redirect(`${base}/parent`, 302);
  res.cookies.set("manara_parent_token", token, {
    httpOnly: true, secure: u.protocol === "https:", sameSite: "lax", path: "/", maxAge: 365 * 86400,
  });
  return res;
}

function bad(base: string, msg: string) {
  return new NextResponse(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رابط المتابعة</title></head><body style="font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f1f5f9;margin:0"><div style="background:#fff;border-radius:16px;padding:32px;max-width:380px;text-align:center"><div style="font-size:40px">⚠️</div><p style="font-weight:700;color:#b45309">${msg}</p><a href="${base}" style="display:inline-block;margin-top:12px;background:#1A73E8;color:#fff;font-weight:700;padding:10px 24px;border-radius:12px;text-decoration:none">الصفحة الرئيسية</a></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
