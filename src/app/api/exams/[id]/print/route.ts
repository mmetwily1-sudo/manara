import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/exams/[id]/print — أسئلة الامتحان للطباعة مع الإجابات (معلم) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: ex } = await sb.from("exams").select("id,title,duration_minutes").eq("id", params.id).eq("tenant_id", tid).single();
  if (!ex) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { data: links } = await sb.from("exam_questions")
    .select("position,marks,questions(body,options,correct_answer,qtype)")
    .eq("exam_id", params.id).eq("tenant_id", tid).order("position", { ascending: true }).limit(200);
  return NextResponse.json({
    ok: true, title: (ex as any).title, duration: (ex as any).duration_minutes,
    questions: ((links ?? []) as any[]).map((l) => ({
      body: (l.questions as any)?.body ?? "",
      options: Array.isArray((l.questions as any)?.options) ? (l.questions as any).options : null,
      correct: (l.questions as any)?.correct_answer ?? null,
      marks: Number(l.marks ?? 0) || 0,
      qtype: (l.questions as any)?.qtype ?? "mcq",
    })),
  });
}
