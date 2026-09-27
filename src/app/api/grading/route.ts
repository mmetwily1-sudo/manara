import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

const AUTO = new Set(["mcq", "true_false", "short_answer"]);

/** GET /api/grading?exam_id= — محاولات بها إجابات مقالية تحتاج تصحيحاً يدوياً */
export async function GET(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const examId = new URL(req.url).searchParams.get("exam_id") ?? "";
  if (!examId) return NextResponse.json({ ok: false, error: "exam_required" }, { status: 400 });
  const { data: ex } = await sb.from("exams").select("id,title").eq("id", examId).eq("tenant_id", tid).single();
  if (!ex) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const [{ data: links }, { data: atts }] = await Promise.all([
    sb.from("exam_questions").select("question_id,marks,questions(body,qtype)")
      .eq("exam_id", examId).eq("tenant_id", tid).limit(200),
    sb.from("exam_attempts").select("id,student_id,score,answers,users(full_name)")
      .eq("exam_id", examId).eq("tenant_id", tid).order("submitted_at", { ascending: false }).limit(200),
  ]);
  const essayQs = ((links ?? []) as any[]).filter((l) => !AUTO.has((l.questions as any)?.qtype));
  if (!essayQs.length) return NextResponse.json({ ok: true, title: (ex as any).title, essay: false, attempts: [] });
  const total = ((links ?? []) as any[]).reduce((s, l) => s + Number(l.marks ?? 0), 0);
  return NextResponse.json({
    ok: true, title: (ex as any).title, essay: true, total,
    essayQuestions: essayQs.map((l) => ({ id: l.question_id, body: String((l.questions as any)?.body ?? "").slice(0, 120), marks: l.marks })),
    attempts: ((atts ?? []) as any[]).map((a) => ({
      id: a.id, student: (a.users as any)?.full_name ?? "—", score: a.score,
      answers: essayQs.map((l) => ({
        q: l.question_id, body: String((l.questions as any)?.body ?? "").slice(0, 100),
        marks: l.marks, text: String((a.answers as any)?.[l.question_id] ?? ""),
      })).filter((x) => x.text),
    })).filter((a) => a.answers.length > 0),
  });
}

/** PATCH /api/grading {attempt_id, score} — اعتماد درجة يدوية (تشمل المقالي) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const b = await req.json().catch(() => ({} as any));
  const score = Number(b?.score);
  if (!b?.attempt_id || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: att } = await sb.from("exam_attempts").select("id,exam_id")
    .eq("id", b.attempt_id).eq("tenant_id", res.ctx.tenantId).single();
  if (!att) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { error } = await sb.from("exam_attempts").update({ score: Math.round(score) }).eq("id", (att as any).id);
  if (error) return dbFail("grading", error);
  try {
    await sb.from("audit_log").insert({
      tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
      action: "attempt:grade", entity_type: "exam_attempt", entity_id: (att as any).id, details: { score },
    });
  } catch {}
  return NextResponse.json({ ok: true, score: Math.round(score) });
}
