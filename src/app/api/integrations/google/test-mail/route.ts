import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { getProviderToken, googleApi, buildGmailRaw } from "@/lib/google";

/**
 * GET /api/integrations/google/test-mail — يرسل رسالة اختبار لبريد المستخدم نفسه.
 * GET (رابط مباشر من زر) + يرد صفحة نجاح/فشل عربية بسيطة.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.email) return html("سجّل الدخول أولاً ثم أعد المحاولة.", false);
  const token = await getProviderToken();
  if (!token) return html("اربط حساب جوجل أولاً من الإعدادات ← تكاملات جوجل.", false);
  const raw = buildGmailRaw(
    user.email,
    "رسالة اختبار من منارة ✅",
    "مبروك! ربط جيميل يعمل — إشعارات سنترك (فواتير، غياب، نتائج) ستصل من بريدك عبر منارة."
  );
  const r = await googleApi(token, "/gmail/v1/users/me/messages/send", { method: "POST", body: { raw } });
  if (r.unauth) return html("انتهت صلاحية الربط — أعد الربط من الإعدادات ← تكاملات جوجل.", false);
  if (!r.ok) return html("تعذر الإرسال — تحقق من صلاحية Gmail ثم حاول تاني.", false);
  try {
    const admin = adminClient();
    const { data: u } = await admin.from("users").select("tenant_id,id").eq("auth_user_id", user.id).limit(1).single();
    if ((u as any)?.tenant_id) {
      await admin.from("audit_log").insert({
        tenant_id: (u as any).tenant_id, actor_id: (u as any).id,
        action: "gmail:test", entity_type: "message", entity_id: user.email, details: {},
      });
    }
  } catch {}
  return html(`تم الإرسال ✅ — تفقد بريد <bdi dir="ltr">${user.email}</bdi> (وتفقد السبام).`, true);
}

function html(msg: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>اختبار جيميل</title></head><body style="font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f1f5f9;margin:0"><div style="background:#fff;border-radius:16px;padding:32px;max-width:380px;text-align:center;box-shadow:0 8px 30px -6px rgba(0,0,0,.15)"><div style="font-size:40px">${ok ? "✅" : "⚠️"}</div><p style="font-weight:700;color:${ok ? "#059669" : "#b45309"}">${msg}</p><a href="/dashboard/settings" style="display:inline-block;margin-top:12px;background:#1A73E8;color:#fff;font-weight:700;padding:10px 24px;border-radius:12px;text-decoration:none">رجوع للإعدادات</a></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
