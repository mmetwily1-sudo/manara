import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { makePin, hashPin } from "@/lib/student-auth";

/**
 * POST /api/students/pin-set { student_id } — المالك يولد/يجدد PIN الطالب (يُعرض مرة واحدة).
 */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const studentId = String(b?.student_id ?? "");
  if (!studentId) return NextResponse.json({ ok: false, error: "student_required" }, { status: 400 });
  const { data: st } = await res.ctx.admin.from("users").select("id,tenant_id,role")
    .eq("id", studentId).eq("tenant_id", res.ctx.tenantId).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const pin = makePin();
  await res.ctx.admin.from("users").update({
    pin_hash: hashPin(pin, res.ctx.tenantId), pin_set_at: new Date().toISOString(),
  }).eq("id", studentId);
  // إبطال الجلسات القديمة عند تجديد PIN
  await res.ctx.admin.from("student_sessions").delete().eq("student_id", studentId);
  return NextResponse.json({ ok: true, pin });
}
