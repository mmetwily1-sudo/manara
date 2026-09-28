import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { newTotpSecret, verifyTotp } from "@/lib/totp";

/** GET /api/auth/totp — حالة التفعيل (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("owner_secrets").select("totp_enabled")
    .eq("user_id", res.ctx.userRow.id).single();
  return NextResponse.json({ ok: true, enabled: !!(data as any)?.totp_enabled });
}

/** POST /api/auth/totp {step: setup|enable|disable, code?} — إعداد/تفعيل/إيقاف */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const uid = res.ctx.userRow.id;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  if (b?.step === "setup") {
    const secret = newTotpSecret();
    await admin.from("owner_secrets").upsert(
      { user_id: uid, tenant_id: tid, totp_secret: secret, totp_enabled: false },
      { onConflict: "user_id" }
    );
    const label = `Manara:${uid.slice(0, 8)}`;
    return NextResponse.json({
      ok: true, secret,
      otpauth: `otpauth://totp/${label}?secret=${secret}&issuer=Manara`,
      hint: "أدخل السر في تطبيق Authenticator ثم أكد بكود من 6 أرقام.",
    });
  }
  const { data: row } = await admin.from("owner_secrets").select("totp_secret,totp_enabled")
    .eq("user_id", uid).single();
  if (!row) return NextResponse.json({ ok: false, error: "no_setup" }, { status: 400 });
  if (b?.step === "enable") {
    if (!verifyTotp((row as any).totp_secret, String(b?.code ?? ""))) {
      return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });
    }
    await admin.from("owner_secrets").update({ totp_enabled: true }).eq("user_id", uid);
    try {
      await admin.from("audit_log").insert({
        tenant_id: tid, actor_id: uid, action: "auth:totp_enable", entity_type: "owner_secret", entity_id: uid, details: {},
      });
    } catch {}
    return NextResponse.json({ ok: true, enabled: true });
  }
  if (b?.step === "disable") {
    if ((row as any).totp_enabled && !verifyTotp((row as any).totp_secret, String(b?.code ?? ""))) {
      return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });
    }
    await admin.from("owner_secrets").update({ totp_enabled: false }).eq("user_id", uid);
    return NextResponse.json({ ok: true, enabled: false });
  }
  return NextResponse.json({ ok: false, error: "bad_step" }, { status: 400 });
}
