import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/cash-audits — جرد الخزنة (مالك + محاسب) */
export async function GET() {
  const res = await requireTeacher(R.billingRead);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("cash_audits")
    .select("id,audit_date,expected,actual,note,status,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("audit_date", { ascending: false }).limit(100);
  return NextResponse.json({
    ok: true,
    audits: ((data ?? []) as any[]).map((a) => ({ ...a, diff: Number(a.actual ?? 0) - Number(a.expected ?? 0) })),
  });
}

/** POST /api/cash-audits {expected, actual, note?} — تسجيل جرد (مالك + محاسب) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const expected = Math.round(Number(b?.expected));
  const actual = Math.round(Number(b?.actual));
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected < 0 || actual < 0) {
    return NextResponse.json({ ok: false, error: "bad_numbers" }, { status: 400 });
  }
  const { data, error } = await res.ctx.admin.from("cash_audits").insert({
    tenant_id: res.ctx.tenantId, expected, actual,
    note: String(b?.note ?? "").trim().slice(0, 300),
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("audit-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id, diff: actual - expected });
}

/** PATCH /api/cash-audits {id, status} — اعتماد/رفض العجز أو الفائض (مالك فقط) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["approved", "rejected"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("cash_audits").update({ status: b.status, decided_by: res.ctx.userRow.id })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId).eq("status", "pending");
  if (error) return dbFail("audit-decide", error);
  try {
    await res.ctx.admin.from("audit_log").insert({
      tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
      action: `cash_audit:${b.status}`, entity_type: "cash_audit", entity_id: b.id, details: {},
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
