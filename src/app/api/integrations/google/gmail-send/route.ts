import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { OWNER } from "@/lib/permissions";
import { getProviderToken, googleApi, buildGmailRaw } from "@/lib/google";
import { arError } from "@/lib/auth-errors";

/**
 * POST /api/integrations/google/gmail-send { to, subject, text }
 * قناة بريد مجانية من حساب السنتر — بديل عند تعطل واتساب/SMS.
 * (مالك/طاقم مفوض فقط + حد 10/ساعة)
 */
export async function POST(req: Request) {
  const res = await requireTeacher([OWNER, "supervisor", "accountant"]);
  if ("error" in res) return res.error;
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "gmail-send", 10)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts", message: arError("too_many_attempts") }, { status: 429 });
  }
  const token = await getProviderToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "google_reconnect", message: "اربط حساب جوجل أولاً من الإعدادات ← تكاملات جوجل" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({} as any));
  const to = String(b?.to ?? "").trim();
  const subject = String(b?.subject ?? "").slice(0, 120);
  const text = String(b?.text ?? "").slice(0, 2000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !text) {
    return NextResponse.json({ ok: false, error: "invalid_input", message: "بريد صحيح + عنوان + نص الرسالة" }, { status: 400 });
  }
  const raw = buildGmailRaw(to, subject, text);
  const r = await googleApi(token, "/gmail/v1/users/me/messages/send", { method: "POST", body: { raw } });
  if (r.unauth) {
    return NextResponse.json({ ok: false, error: "google_reconnect", message: "انتهت صلاحية الربط — أعد الربط من الإعدادات" }, { status: 401 });
  }
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "gmail_failed", message: "تعذر الإرسال — حاول تاني" }, { status: 500 });
  }
  try {
    await res.ctx.admin.from("audit_log").insert({
      tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
      action: "gmail:send", entity_type: "message", entity_id: to.slice(0, 60),
      details: { subject },
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
