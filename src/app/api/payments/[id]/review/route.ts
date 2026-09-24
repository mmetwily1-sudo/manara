import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/**
 * POST /api/payments/[id]/review — المعلم يقبل/يرفض مطالبة دفع.
 * { action: "confirm" | "reject" }
 * القبول يرسل إيصال واتساب تلقائياً (نفس قناة الدفع المباشر).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const body = await req.json().catch(() => ({} as any));
  const action = body?.action;
  if (action !== "confirm" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  const { data: pay } = await admin
    .from("payments")
    .select("id,student_id,amount,status")
    .eq("id", params.id)
    .eq("tenant_id", tid)
    .single();
  if (!pay) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if ((pay as any).status !== "pending") {
    return NextResponse.json({ ok: false, error: "already_reviewed" }, { status: 400 });
  }

  const { error } = await admin
    .from("payments")
    .update({
      status: action === "confirm" ? "confirmed" : "rejected",
      confirmed_by: res.ctx.userRow.id,
    })
    .eq("id", params.id)
    .eq("tenant_id", tid);
  if (error) return dbFail("payment-review", error);

  // سجل تدقيق (best-effort)
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: `payment:${action}`, entity_type: "payment", entity_id: params.id,
      details: { amount: Number((pay as any).amount ?? 0) },
    });
  } catch {}

  if (action === "confirm") {
    try {
      const { notifyStudent } = await import("@/lib/notify");
      const { data: trow } = await admin.from("tenants").select("name").eq("id", tid).single();
      await notifyStudent(admin, {
        tenantId: tid,
        studentId: (pay as any).student_id,
        event: {
          kind: "payment_received",
          studentName: "",
          amount: Number((pay as any).amount ?? 0),
          centerName: (trow as any)?.name ?? "",
        },
        dedupeKey: `payment:${params.id}`,
      });
    } catch {}
  }

  return NextResponse.json({ ok: true, action });
}
