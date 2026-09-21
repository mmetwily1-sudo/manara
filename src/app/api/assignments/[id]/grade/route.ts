import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";

/** POST /api/assignments/[id]/grade { student_id, score, feedback_text? } — تصحيح تسليم (معلم). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { data: a } = await admin
    .from("assignments").select("id,title,max_score").eq("id", params.id).eq("tenant_id", tid).single();
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const score = Number(body.score);
  if (!body.student_id || isNaN(score) || score < 0 || score > Number((a as any).max_score)) {
    return NextResponse.json({ ok: false, error: "bad_score", message: `الدرجة من 0 إلى ${(a as any).max_score}.` }, { status: 400 });
  }
  // الطالب من نفس السنتر
  const { data: st } = await admin.from("users").select("id").eq("id", body.student_id).eq("tenant_id", tid).single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });

  const { error } = await admin.from("submissions").update({
    score,
    feedback_text: String(body.feedback_text ?? "").trim().slice(0, 2000) || null,
    status: "graded",
  }).eq("assignment_id", params.id).eq("student_id", body.student_id).eq("tenant_id", tid);
  if (error) return dbFail("grade", error);

  // مكافأة التصحيح حسب النسبة (0..5)
  const { awardPoints, POINTS } = await import("@/lib/gamification");
  const max = Number((a as any).max_score) || 1;
  await awardPoints(admin, tid, body.student_id, Math.round((score / max) * POINTS.gradeBonusMax));

  // إشعار الطالب/ولي الأمر بالنتيجة — best-effort
  try {
    const { notifyStudent } = await import("@/lib/notify");
    await notifyStudent(admin, {
      tenantId: tid,
      studentId: body.student_id,
      event: {
        kind: "homework_graded", studentName: "", hwTitle: (a as any).title ?? "واجب",
        score, total: Number((a as any).max_score),
      },
      dedupeKey: `hw-grade:${params.id}:${body.student_id}:${score}`,
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
