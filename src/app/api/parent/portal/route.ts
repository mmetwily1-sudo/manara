import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import { dbFail } from "@/lib/api-error";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";

/** POST /api/parent/token — إنشاء/تحديث رمز ولي أمر لطالب (مالك/مشرف) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const studentId = String(b?.student_id ?? "");
  if (!studentId) return NextResponse.json({ ok: false, error: "student_required" }, { status: 400 });

  // التحقق: الطالب في نفس السنتر
  const { data: st } = await res.ctx.admin.from("users").select("id,tenant_id").eq("id", studentId).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update("parent:" + token).digest("hex");
  const expires = new Date(Date.now() + 365 * 864e5).toISOString(); // سنة

  const { error } = await res.ctx.admin.from("parent_portal_sessions").upsert({
    tenant_id: tid, parent_id: res.ctx.userRow.id, student_id: studentId,
    token_hash: tokenHash, expires_at: expires,
  }, { onConflict: "tenant_id,parent_id,student_id" });
  if (error) return dbFail("parent-token", error);

  return NextResponse.json({ ok: true, token, expires_at: expires });
}

/** GET /api/parent/portal — بيانات الطالب للموقع العام (بالتوكين في الكوكيز/الهيدر) */
/** حالة ربط تليجرام للطالب: رابط عميق + هل مربوط — بلا أسرار */
async function telegramState(admin: any, tenantId: string, studentId: string) {
  try {
    const { telegramLinkFor, botUsername } = await import("@/lib/telegram");
    const bot = botUsername();
    if (!bot) return { on: false };
    const { data: link } = await admin.from("telegram_links").select("chat_id")
      .eq("tenant_id", tenantId).eq("user_id", studentId).limit(1).single();
    return { on: true, linked: !!(link as any)?.chat_id, url: telegramLinkFor(studentId) };
  } catch {
    return { on: false };
  }
}

export async function GET(req: Request) {
  const cookieStore = cookies();
  const token = req.headers.get("x-parent-token") ?? cookieStore.get("manara_parent_token")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const tokenHash = createHash("sha256").update("parent:" + token).digest("hex");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: sess } = await admin.from("parent_portal_sessions").select("id,student_id,expires_at")
    .eq("token_hash", tokenHash).limit(1).single();
  if (!sess || new Date((sess as any).expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
  }
  const sid = (sess as any).student_id;
  const { data: st } = await admin.from("users").select("id,full_name,phone").eq("id", (sess as any).student_id).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "student_not_found" }, { status: 404 });
  const { data: tn } = await admin.from("tenants").select("status").eq("id", (sess as any).tenant_id).single();
  if ((tn as any)?.status && (tn as any).status !== "active") {
    return NextResponse.json({ ok: false, error: "tenant_suspended", message: "حساب السنتر موقوف مؤقتاً — تواصل مع الإدارة" }, { status: 403 });
  }
  const [{ data: att }, { data: grades }, { data: inv }] = await Promise.all([
    admin.from("attendance").select("status,session_id,sessions!inner(session_date)").eq("tenant_id", (sess as any).tenant_id).eq("student_id", sid).order("created_at", { ascending: false }).limit(50),
    admin.from("exam_attempts").select("score,exam_id,exams(title),submitted_at").eq("tenant_id", (sess as any).tenant_id).eq("student_id", sid).order("submitted_at", { ascending: false }).limit(20),
    admin.from("invoices").select("period,amount,paid,status,receipt_no").eq("tenant_id", (sess as any).tenant_id).eq("student_id", sid).neq("status", "paid").limit(50),
  ]);
  const present = ((att ?? []) as any[]).filter((a) => a.status === "present").length;
  const absent = ((att ?? []) as any[]).filter((a) => a.status === "absent").length;
  const due = ((inv ?? []) as any[]).reduce((s, x) => s + Math.max(0, Number(x.amount ?? 0) - Number(x.paid ?? 0)), 0);
  const { data: brand } = await admin.from("tenants").select("name,logo_url,primary_color,online_payment_enabled")
    .eq("id", (sess as any).tenant_id).single();
  return NextResponse.json({
    ok: true,
    branding: { name: (brand as any)?.name ?? "", logo_url: (brand as any)?.logo_url ?? null, primary_color: (brand as any)?.primary_color ?? "#1A73E8" },
    student: { name: (st as any).full_name, phone: (st as any).phone },
    telegram: await telegramState(admin, (sess as any).tenant_id, sid),
    attendance: { present, absent, total: present + absent },
    grades: (grades ?? []).map((g) => ({ exam: (g.exams as any)?.title, score: g.score, total: (g.exams as any)?.total_marks, at: g.submitted_at })),
    dues: (inv ?? []).map((x) => ({ period: x.period, amount: x.amount, paid: x.paid, due: Number(x.amount) - Number(x.paid), status: x.status, receipt: x.receipt_no })),
    online_payment: { enabled: (brand as any)?.online_payment_enabled ?? false },
  });
}