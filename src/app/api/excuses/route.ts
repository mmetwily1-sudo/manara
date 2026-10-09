import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/excuses — أعذار الغياب (طاقم التحضير) */
export async function GET() {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("absence_excuses")
    .select("id,student_id,session_id,reason,status,created_at,users(full_name)")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
  return NextResponse.json({ ok: true, excuses: data ?? [] });
}

/** POST /api/excuses {student_id, session_id?, reason?} — تسجيل عذر */
export async function POST(req: Request) {
  const res = await requireTeacher(R.attendance, { req: req });
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: st } = await sb.from("users").select("id").eq("id", b?.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { data, error } = await sb.from("absence_excuses").insert({
    tenant_id: tid, student_id: (st as any).id, session_id: b?.session_id || null,
    reason: String(b?.reason ?? "").trim().slice(0, 300),
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("excuse-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/excuses {id, status} — اعتماد/رفض (مالك + مشرف) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.content, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["approved", "rejected"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("absence_excuses").update({ status: b.status, decided_by: res.ctx.userRow.id })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId).eq("status", "pending");
  if (error) return dbFail("excuse-decide", error);
  return NextResponse.json({ ok: true });
}
