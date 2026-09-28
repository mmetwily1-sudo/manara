import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** GET /api/me/export — نسخة من بياناتي (طالب) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users")
    .select("id,tenant_id,role,full_name,phone,points,created_at")
    .eq("auth_user_id", user.id).single();
  if (!urow || (urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  }
  const sid = (urow as any).id;
  const tid = (urow as any).tenant_id;
  const [enr, inv, pay, subs, exams] = await Promise.all([
    admin.from("enrollments").select("group_id,status,created_at").eq("student_id", sid).limit(100),
    admin.from("invoices").select("period,amount,paid,status").eq("student_id", sid).limit(200),
    admin.from("payments").select("amount,status,created_at").eq("student_id", sid).limit(200),
    admin.from("submissions").select("assignment_id,status,score,submitted_at").eq("student_id", sid).limit(500),
    admin.from("exam_attempts").select("exam_id,score,submitted_at").eq("student_id", sid).limit(200),
  ]);
  return NextResponse.json({
    ok: true,
    exported_at: new Date().toISOString(),
    profile: { full_name: (urow as any).full_name, phone: (urow as any).phone, points: (urow as any).points },
    enrollments: enr.data ?? [], invoices: inv.data ?? [], payments: pay.data ?? [],
    submissions: subs.data ?? [], exam_attempts: exams.data ?? [],
  });
}
