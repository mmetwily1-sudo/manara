import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/refunds — طلبات الاسترداد (مالك + محاسب) */
export async function GET() {
  const res = await requireTeacher(R.billingRead);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("refunds")
    .select("id,payment_id,student_id,amount,reason,status,created_at,users(full_name)")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ ok: true, refunds: data ?? [] });
}

/** POST /api/refunds {payment_id, reason?} — طلب استرداد (مالك + محاسب) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: pay } = await sb.from("payments").select("id,student_id,amount,status")
    .eq("id", b?.payment_id).eq("tenant_id", tid).single();
  if (!pay || (pay as any).status !== "confirmed") {
    return NextResponse.json({ ok: false, error: "bad_payment" }, { status: 400 });
  }
  const { data, error } = await sb.from("refunds").insert({
    tenant_id: tid, payment_id: (pay as any).id, student_id: (pay as any).student_id,
    amount: Number((pay as any).amount ?? 0),
    reason: String(b?.reason ?? "").trim().slice(0, 300),
    requested_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("refund-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/refunds {id, status} — اعتماد/رفض (مالك فقط؛ الاعتماد يلغي الدفعة) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  if (!["approved", "rejected"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { data: rf } = await sb.from("refunds").select("id,payment_id,student_id,amount,requested_by")
    .eq("id", b.id).eq("tenant_id", tid).eq("status", "pending").single();
  if (!rf) return NextResponse.json({ ok: false, error: "not_pending" }, { status: 400 });
  if (b.status === "approved") {
    // فصل مالي: المعتمد لا يكون هو الطالب — وإن كان هو، يلزم كود التحقق بخطوتين
    if ((rf as any).requested_by === res.ctx.userRow.id) {
      const { totpRequired, totpOk } = await import("@/lib/totp");
      if (!(await totpRequired(sb, res.ctx.userRow.id))) {
        return NextResponse.json({ ok: false, error: "needs_second", message: "طالب الاسترداد لا يعتمده — اطلب من المالك أو فعّل التحقق بخطوتين." }, { status: 403 });
      }
      if (!(await totpOk(sb, res.ctx.userRow.id, b?.totp))) {
        return NextResponse.json({ ok: false, error: "totp_required" }, { status: 403 });
      }
    }
    await sb.from("payments").update({ status: "rejected", note: "مستردة بموافقة المالك" })
      .eq("id", (rf as any).payment_id).eq("tenant_id", tid);
  }
  const { error } = await sb.from("refunds").update({ status: b.status, decided_by: res.ctx.userRow.id })
    .eq("id", b.id).eq("tenant_id", tid).eq("status", "pending");
  if (error) return dbFail("refund-decide", error);
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: `refund:${b.status}`, entity_type: "refund", entity_id: b.id,
      details: { payment: (rf as any).payment_id, amount: (rf as any).amount },
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
