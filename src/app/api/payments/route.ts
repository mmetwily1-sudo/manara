import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/payments — سجل الدفعات + ملخص الشهر */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const { data: payments, error } = await ctx.admin
    .from("payments")
    .select("id,amount,method,status,note,paid_at,student_id,receipt_no")
    .eq("tenant_id", ctx.tenantId)
    .order("paid_at", { ascending: false })
    .limit(100);
  if (error) return dbFail("payments", error);

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

  let collectedMonth = 0, collectedToday = 0, todayCount = 0;
  const byMethod: Record<string, { total: number; count: number }> = {};
  (payments ?? []).forEach((p: any) => {
    if (p.status !== "confirmed") return;
    const amt = Number(p.amount ?? 0);
    if (p.paid_at >= monthStart) collectedMonth += amt;
    if (p.paid_at >= todayStart) {
      collectedToday += amt;
      todayCount += 1;
      const mk = String(p.method ?? "cash");
      byMethod[mk] ??= { total: 0, count: 0 };
      byMethod[mk].total += amt;
      byMethod[mk].count += 1;
    }
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
    close: { date: new Date().toISOString().slice(0, 10), total: collectedToday, count: todayCount, byMethod },
    payments: (payments ?? []).map((p: any) => ({
      id: p.id,
      student: names[p.student_id] ?? "—",
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      note: p.note,
      receipt_no: p.receipt_no ?? null,
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

  // رقم إيصال متسلسل لكل سنتر (تفاؤلي: قراءة + تحديث مشروط — التكرار مستحيل عملياً بسرعة التحصيل اليدوي)
  let receiptNo: number | null = null;
  try {
    await ctx.admin.from("tenant_counters").insert({ tenant_id: ctx.tenantId, receipt_seq: 0 });
  } catch {}
  try {
    const { data: cur } = await ctx.admin.from("tenant_counters").select("receipt_seq").eq("tenant_id", ctx.tenantId).single();
    const next = Number((cur as any)?.receipt_seq ?? 0) + 1;
    const { data: upd } = await ctx.admin.from("tenant_counters").update({ receipt_seq: next })
      .eq("tenant_id", ctx.tenantId).eq("receipt_seq", Number((cur as any)?.receipt_seq ?? 0)).select("receipt_seq").single();
    receiptNo = Number((upd as any)?.receipt_seq ?? next);
  } catch {}

  const { data, error } = await ctx.admin.from("payments").insert({
    tenant_id: ctx.tenantId,
    student_id: studentId,
    group_id: enr?.group_id ?? null,
    amount,
    method,
    status: "confirmed",
    confirmed_by: ctx.userRow.id,
    note,
    receipt_no: receiptNo,
  }).select("id").single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  // ترحيل المبلغ تلقائياً على أقدم فواتير الطالب غير المسددة (FIFO)
  try {
    let rest = amount;
    const { data: open } = await ctx.admin.from("invoices").select("id,amount,paid")
      .eq("tenant_id", ctx.tenantId).eq("student_id", studentId).neq("status", "paid")
      .order("period", { ascending: true }).limit(20);
    for (const iv of (open ?? []) as any[]) {
      if (rest <= 0) break;
      const owe = Number(iv.amount ?? 0) - Number(iv.paid ?? 0);
      if (owe <= 0) continue;
      const take = Math.min(owe, rest);
      rest -= take;
      const nPaid = Number(iv.paid ?? 0) + take;
      await ctx.admin.from("invoices").update({
        paid: nPaid,
        status: nPaid >= Number(iv.amount ?? 0) ? "paid" : "partial",
        paid_at: nPaid >= Number(iv.amount ?? 0) ? new Date().toISOString() : null,
        receipt_no: receiptNo,
      }).eq("id", iv.id);
      if (!rest) {
        await ctx.admin.from("payments").update({ invoice_id: iv.id }).eq("id", (data as any).id);
      }
    }
  } catch {}

  // سجل تدقيق (best-effort — جدول audit_log موجود)
  try {
    await ctx.admin.from("audit_log").insert({
      tenant_id: ctx.tenantId, actor_id: ctx.userRow.id,
      action: "payment:collect", entity_type: "payment", entity_id: (data as any).id,
      details: { studentId, amount, method },
    });
  } catch {}

  // إيصال واتساب فوري (best-effort)
  try {
    const { notifyStudent } = await import("@/lib/notify");
    const { data: trow } = await ctx.admin.from("tenants").select("name").eq("id", ctx.tenantId).single();
    await notifyStudent(ctx.admin, {
      tenantId: ctx.tenantId,
      studentId,
      event: { kind: "payment_received", studentName: "", amount, centerName: (trow as any)?.name ?? "" },
      dedupeKey: `payment:${(data as any).id}`,
    });
  } catch {}

  return NextResponse.json({ ok: true, id: (data as any).id, receipt_no: receiptNo });
}
