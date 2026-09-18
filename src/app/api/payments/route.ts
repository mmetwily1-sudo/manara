import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/payments — سجل الدفعات + ملخص الشهر */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const { data: payments, error } = await ctx.admin
    .from("payments")
    .select("id,amount,method,status,note,paid_at,student_id")
    .eq("tenant_id", ctx.tenantId)
    .order("paid_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: students } = await ctx.admin
    .from("users")
    .select("id,full_name")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "student");
  const names: Record<string, string> = {};
  (students ?? []).forEach((s: any) => { names[s.id] = s.full_name; });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let collectedMonth = 0, collectedToday = 0;
  (payments ?? []).forEach((p: any) => {
    if (p.status !== "confirmed") return;
    const amt = Number(p.amount ?? 0);
    if (p.paid_at >= monthStart) collectedMonth += amt;
    if (p.paid_at >= todayStart) collectedToday += amt;
  });

  // المتوقع الشهري = مجموع اشتراكات التسجيلات النشطة
  const { data: enrolls } = await ctx.admin
    .from("enrollments")
    .select("special_price,groups(monthly_fee)")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "active");
  let expected = 0;
  (enrolls ?? []).forEach((e: any) => {
    expected += Number(e.special_price ?? e.groups?.monthly_fee ?? 0);
  });
  const outstanding = Math.max(0, expected - collectedMonth);

  return NextResponse.json({
    ok: true,
    totals: { collectedMonth, collectedToday, expected, outstanding },
    payments: (payments ?? []).map((p: any) => ({
      id: p.id,
      student: names[p.student_id] ?? "—",
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      note: p.note,
      paid_at: p.paid_at,
    })),
  });
}

/** POST /api/payments — تسجيل دفعة جديدة */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null as any);
  const studentId = (body?.studentId ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const method = (body?.method ?? "cash").trim();
  const note = (body?.note ?? "").trim() || null;

  if (!studentId) return NextResponse.json({ ok: false, error: "missing_student" }, { status: 400 });
  if (!amount || amount <= 0) return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  if (!["cash", "wallet", "instapay", "card", "fawry"].includes(method)) {
    return NextResponse.json({ ok: false, error: "invalid_method" }, { status: 400 });
  }

  const { data: st } = await ctx.admin
    .from("users")
    .select("id")
    .eq("id", studentId)
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "student")
    .single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });

  const { data: enr } = await ctx.admin
    .from("enrollments")
    .select("group_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1)
    .single();

  const { data, error } = await ctx.admin.from("payments").insert({
    tenant_id: ctx.tenantId,
    student_id: studentId,
    group_id: enr?.group_id ?? null,
    amount,
    method,
    status: "confirmed",
    confirmed_by: ctx.userRow.id,
    note,
  }).select("id").single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
