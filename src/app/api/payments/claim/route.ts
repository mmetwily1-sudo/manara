import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { isRateLimited } from "@/lib/rate-limit";

const CLAIM_METHODS = ["instapay", "wallet", "fawry", "card"];

/** GET /api/payments/claim — مطالباتي وحالاتها (طالب) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const { data } = await admin.from("payments").select("id,amount,method,status,note,paid_at")
    .eq("tenant_id", (urow as any).tenant_id).eq("student_id", (urow as any).id)
    .order("paid_at", { ascending: false }).limit(20);
  return NextResponse.json({ ok: true, claims: data ?? [] });
}

/**
 * POST /api/payments/claim — الطالب يُبلغ عن تحويل (انستاباي/محفظة/فوري)
 * ينشئ دفعة pending يراجعها المعلم. { amount, method, reference }
 */
export async function POST(req: Request) {
  if (isRateLimited(req, "pay-claim", 5)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const amount = Number(body?.amount ?? 0);
  const method = String(body?.method ?? "");
  const reference = String(body?.reference ?? "").trim().slice(0, 100);
  if (!amount || amount <= 0 || amount > 100000) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }
  if (!CLAIM_METHODS.includes(method)) {
    return NextResponse.json({ ok: false, error: "invalid_method" }, { status: 400 });
  }
  if (!reference) {
    return NextResponse.json({ ok: false, error: "reference_required", message: "اكتب رقم العملية/التحويل" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: urow } = await admin
    .from("users")
    .select("id,tenant_id,role")
    .eq("auth_user_id", user.id)
    .single();
  if (!urow?.tenant_id) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  if ((urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: enr } = await admin
    .from("enrollments")
    .select("group_id")
    .eq("tenant_id", (urow as any).tenant_id)
    .eq("student_id", (urow as any).id)
    .eq("status", "active")
    .limit(1)
    .single();

  const { data, error } = await admin
    .from("payments")
    .insert({
      tenant_id: (urow as any).tenant_id,
      student_id: (urow as any).id,
      group_id: enr?.group_id ?? null,
      amount,
      method,
      status: "pending",
      note: `مرجع: ${reference}`,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: (data as any).id });
}
