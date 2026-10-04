/**
 * دخول الطالب برقم الهاتف + PIN (6 أرقام) — لطلاب المدرس بلا بريد إلكتروني.
 * - PIN يُخزن hash فقط (SHA-256 + فلفل الخادم + tenant).
 * - الجلسة: توكن عشوائي مخزن hash في student_sessions + كوكيز httpOnly (سنة).
 * - 5 محاولات خاطئة/15 دقيقة لكل هاتف (حد ذاكرة محلي).
 */

import { createHash, randomBytes } from "node:crypto";

function pepper(): string {
  return process.env.STUDENT_PIN_PEPPER ?? process.env.CRON_SECRET ?? "manara-pin";
}

export function makePin(): string {
  let pin = "";
  while (pin.length < 6) {
    const n = Math.floor(Math.random() * 10);
    if (pin.length === 0 && n === 0) continue;
    pin += String(n);
  }
  return pin;
}

export function hashPin(pin: string, tenantId: string): string {
  return createHash("sha256").update(`spin:${tenantId}:${pin}:${pepper()}`).digest("hex");
}

export function makeSessionToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update("student:" + token).digest("hex");
  return { token, hash };
}

const attempts = new Map<string, { count: number; resetAt: number }>();

/** حد المحاولات — true تعني مسموح، false تعني محظور مؤقتاً */
export function pinRateOk(key: string): boolean {
  const now = Date.now();
  const b = attempts.get(key);
  if (!b || now >= b.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60000 });
    return true;
  }
  b.count++;
  if (b.count > 5) return false;
  return true;
}

export type StudentSession = { studentId: string; tenantId: string } | null;
/** قراءة جلسة الطالب من الكوكيز (خادم فقط) */
export async function getStudentSession(admin: any, token: string): Promise<StudentSession> {  if (!token || token.length < 10) return null;
  const hash = createHash("sha256").update("student:" + token).digest("hex");
  const { data: sess } = await admin.from("student_sessions").select("student_id,tenant_id,expires_at")
    .eq("token_hash", hash).limit(1).single();
  if (!sess || new Date((sess as any).expires_at).getTime() < Date.now()) return null;
  return { studentId: (sess as any).student_id, tenantId: (sess as any).tenant_id };
}

export type MeContext = { admin: any; tenantId: string; studentId: string };

/**
 * سياق "أنا طالب": جلسة Supabase أولاً، ثم كوكيز PIN.
 * يوحّد /api/me/* للطالب المسجل بريدياً وطالب المدرس (PIN) معاً.
 */
export async function resolveMeStudent(req: Request): Promise<MeContext | { error: ReturnType<typeof import("next/server").NextResponse.json> }> {
  const { NextResponse } = await import("next/server");
  const { getSessionUser, adminClient } = await import("./server-auth");
  let admin: any;
  try {
    admin = adminClient();
  } catch {
    return { error: NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 }) };
  }
  const user = await getSessionUser().catch(() => null);
  if (user) {
    const { data: urow } = await admin.from("users").select("id,tenant_id")
      .eq("auth_user_id", user.id).limit(1).single();
    if ((urow as any)?.id) {
      return { admin, tenantId: (urow as any).tenant_id, studentId: (urow as any).id };
    }
  }
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)manara_student_token=([^;]+)/);
  const sess = await getStudentSession(admin, m ? decodeURIComponent(m[1]) : "");
  if (!sess) return { error: NextResponse.json({ ok: false, error: "unauth" }, { status: 401 }) };
  return { admin, tenantId: sess.tenantId, studentId: sess.studentId };
}
