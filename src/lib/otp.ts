import { createHash, randomInt, timingSafeEqual } from "crypto";

/**
 * رموز تحقق الهاتف (OTP) — تُخزَّن hash فقط، صالحة 10 دقائق، 5 محاولات.
 * يتطلب جدول otp_codes (ترحيل database/migrations/003).
 */

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function genCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(`otp:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** إنشاء رمز جديد (يُبطل السابق لنفس الغرض) — يرجع الرمز الصريح لإرساله */
export async function createOtp(
  admin: any,
  tenantId: string,
  phone: string,
  purpose: string
): Promise<{ code: string } | { error: string }> {
  // حد إعادة الإرسال: رمز واحد نشط كل دقيقة لنفس الرقم+الغرض
  const since = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS).toISOString();
  const { data: recent } = await admin
    .from("otp_codes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .gte("created_at", since)
    .limit(1);
  if (recent?.length) return { error: "cooldown" };

  // إبطال أي رموز سابقة غير مستهلكة
  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const code = genCode();
  const { error } = await admin.from("otp_codes").insert({
    tenant_id: tenantId,
    phone,
    purpose,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });
  if (error) {
    // الجدول غير موجود = الترحيل لم يُنفذ بعد
    if (error.code === "42P01" || error.message?.includes("otp_codes")) {
      return { error: "db_not_ready" };
    }
    return { error: "create_failed" };
  }
  return { code };
}

/** التحقق من الرمز — يستهلكه عند النجاح، ويحسب المحاولات */
export async function verifyOtp(
  admin: any,
  tenantId: string,
  phone: string,
  purpose: string,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "bad_code" };

  const { data: row } = await admin
    .from("otp_codes")
    .select("id,code_hash,expires_at,attempts")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, error: "no_code" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }
  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "locked" };
  }
  if (!safeEqual(hashCode(clean), row.code_hash)) {
    await admin.from("otp_codes").update({ attempts: (row.attempts ?? 0) + 1 }).eq("id", row.id);
    return { ok: false, error: "wrong_code" };
  }
  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ok: true };
}
