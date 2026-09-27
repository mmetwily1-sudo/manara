import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/students/[id]/plan — خطة تعلم شخصية: أضعف الدروس من نتائج الامتحانات */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const sid = params.id;

  const { data: atts } = await admin.from("exam_attempts").select("score,exam_id,exams(title)")
    .eq("tenant_id", tid).eq("student_id", sid).order("submitted_at", { ascending: false }).limit(10);
  const weak: Record<string, { lesson: string; subject: string; fails: number }> = {};
  let total = 0, sum = 0;
  for (const a of (atts ?? []) as any[]) {
    const { data: qs } = await admin.from("exam_questions").select("marks")
      .eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(200);
    const t = ((qs ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 0), 0);
    if (t <= 0) continue;
    const pct = (Number(a.score ?? 0) / t) * 100;
    total++; sum += pct;
    if (pct < 60) {
      const { data: links } = await admin.from("exam_questions").select("question_id,questions(subject,lesson)")
        .eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(100);
      for (const l of (links ?? []) as any[]) {
        const key = `${l.questions?.subject ?? ""}::${l.questions?.lesson ?? "عام"}`;
        const w = weak[key] ??= { lesson: l.questions?.lesson ?? "مراجعة عامة", subject: l.questions?.subject ?? "", fails: 0 };
        w.fails++;
      }
    }
  }
  const avg = total ? Math.round(sum / total) : null;
  const lessons = Object.values(weak).sort((a, b) => b.fails - a.fails).slice(0, 5);
  const steps = lessons.map((l, i) => `${i + 1}. راجع درس «${l.lesson}»${l.subject ? ` (${l.subject})` : ""} ثم حل كويز قصير عليه`);
  if (!steps.length && avg !== null && avg >= 60) steps.push("مستواك ثابت — حافظ عليه بهدف نقاط جديد 🎯");
  if (!steps.length && avg === null) steps.push("لا امتحانات بعد — ابدأ بأول كويز لتظهر خطتك هنا 📝");
  return NextResponse.json({ ok: true, avg, lessons, steps });
}
