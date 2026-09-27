import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/**
 * POST /api/exams/[id]/duplicate {title?} — نسخ امتحان بأسئلته (مسودة غير منشورة).
 * يوفر إعادة الإنشاء اليدوي لكل مجموعة — أعلى تكرار استخدام يومي (قرار اللجنة).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  try {
    const { data: src } = await admin.from("exams")
      .select("id,title,duration_minutes,total_marks,require_code")
      .eq("id", params.id).eq("tenant_id", tid).single();
    if (!src) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const body = await req.json().catch(() => ({} as any));
    const title = String(body?.title ?? "").trim().slice(0, 120) || `${(src as any).title} — نسخة`;
    const { data: copy, error: cErr } = await admin.from("exams").insert({
      tenant_id: tid, title,
      duration_minutes: (src as any).duration_minutes ?? 30,
      total_marks: (src as any).total_marks ?? null,
      is_published: false,
      require_code: !!(src as any).require_code,
    }).select("id").single();
    if (cErr || !copy) return dbFail("exam-duplicate", cErr);

    const { data: links } = await admin.from("exam_questions")
      .select("question_id,position,marks").eq("exam_id", params.id).eq("tenant_id", tid).limit(200);
    let copied = 0;
    if (links?.length) {
      const rows = (links as any[]).map((l: any) => ({
        tenant_id: tid, exam_id: (copy as any).id,
        question_id: l.question_id, position: l.position, marks: l.marks,
      }));
      const { error: lErr } = await admin.from("exam_questions").insert(rows);
      if (!lErr) copied = rows.length;
    }
    try {
      await admin.from("audit_log").insert({
        tenant_id: tid, actor_id: res.ctx.userRow.id,
        action: "exam:duplicate", entity_type: "exam", entity_id: (copy as any).id,
        details: { from: params.id, questions: copied },
      });
    } catch {}
    return NextResponse.json({ ok: true, id: (copy as any).id, questions: copied });
  } catch (e: any) {
    return dbFail("exam-duplicate", e);
  }
}
