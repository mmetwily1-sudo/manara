import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/team/leaves — طلبات الإجازة (طاقم: طلباته؛ مالك: الكل) */
export async function GET() {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const isOwner = res.ctx.userRow.role === "teacher_admin";
  let q = admin.from("leave_requests").select("id,user_id,from_date,to_date,reason,status,created_at,users(full_name)")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
  if (!isOwner) q = q.eq("user_id", res.ctx.userRow.id);
  const { data } = await q;
  return NextResponse.json({ ok: true, leaves: data ?? [], isOwner });
}

/** POST /api/team/leaves {from_date, to_date, reason?} — طلب إجازة (أي طاقم) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.from_date || !b?.to_date || String(b.from_date) > String(b.to_date)) {
    return NextResponse.json({ ok: false, error: "bad_dates" }, { status: 400 });
  }
  const { data, error } = await res.ctx.admin.from("leave_requests").insert({
    tenant_id: res.ctx.tenantId, user_id: res.ctx.userRow.id,
    from_date: b.from_date, to_date: b.to_date, reason: String(b?.reason ?? "").trim().slice(0, 300),
  }).select("id").single();
  if (error || !data) return dbFail("leave-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/team/leaves {id, status} — اعتماد/رفض (مالك فقط) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["approved", "rejected"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("leave_requests").update({ status: b.status, decided_by: res.ctx.userRow.id })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId).eq("status", "pending");
  if (error) return dbFail("leave-decide", error);
  return NextResponse.json({ ok: true });
}
