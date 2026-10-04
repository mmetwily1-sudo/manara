import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** GET /api/me/plan — خطة الطالب: ترتيبه النسبي + متوسط مجموعته + دروسه المتأخرة + خطوات الأسبوع */
export async function GET(req: Request) {
  const { resolveMeStudent } = await import("@/lib/student-auth");
  const ctx = await resolveMeStudent(req);
  if ("error" in ctx) return ctx.error;
  const { admin, tenantId, studentId } = ctx;
  const { data: urow } = await admin.from("users").select("id,tenant_id,points")
    .eq("id", studentId).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;
  const myPts = Number((urow as any).points ?? 0) || 0;

  // مجموعاته + ترتيبه ومتوسطها
  const { data: enr } = await admin.from("enrollments").select("group_id,groups(name)")
    .eq("tenant_id", tid).eq("student_id", sid).eq("status", "active").limit(20);
  const gids = ((enr ?? []) as any[]).map((e) => e.group_id);
  let rank: number | null = null, of = 0, groupAvg: number | null = null, groupName: string | null = null;
  if (gids.length) {
    const { data: mates } = await admin.from("enrollments").select("student_id")
      .eq("tenant_id", tid).eq("status", "active").in("group_id", gids).limit(1000);
    const ids: string[] = [];
    ((mates ?? []) as any[]).forEach((m) => { if (!ids.includes(m.student_id)) ids.push(m.student_id); });
    if (ids.length) {
      const { data: pts } = await admin.from("users").select("id,points").in("id", ids).limit(1000);
      const arr = ((pts ?? []) as any[]).map((p) => ({ id: p.id, pts: Number(p.points ?? 0) || 0 }))
        .sort((a, b) => b.pts - a.pts);
      of = arr.length;
      const idx = arr.findIndex((p) => p.id === sid);
      rank = idx >= 0 ? idx + 1 : null;
      groupAvg = arr.length ? Math.round(arr.reduce((s, p) => s + p.pts, 0) / arr.length) : null;
      groupName = ((enr as any[])?.[0]?.groups as any)?.name ?? null;
    }
  }

  // أضعف الدروس: امتحانات <60% → دروس أسئلتها
  const { data: atts } = await admin.from("exam_attempts").select("score,exam_id")
    .eq("tenant_id", tid).eq("student_id", sid).order("submitted_at", { ascending: false }).limit(10);
  const weak: Record<string, number> = {};
  for (const a of (atts ?? []) as any[]) {
    const { data: qs } = await admin.from("exam_questions").select("marks").eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(200);
    const total = ((qs ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 0), 0);
    if (total <= 0) continue;
    if ((Number(a.score ?? 0) / total) * 100 >= 60) continue;
    const { data: links } = await admin.from("exam_questions").select("question_id,questions(subject,lesson)")
      .eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(100);
    for (const l of (links ?? []) as any[]) {
      const key = `${(l.questions as any)?.subject ?? ""}::${(l.questions as any)?.lesson ?? "مراجعة عامة"}`;
      weak[key] = (weak[key] ?? 0) + 1;
    }
  }
  const lessons = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k]) => { const [s, l] = k.split("::"); return { subject: s, lesson: l }; });
  const steps = lessons.map((l, i) => `${i + 1}. راجع «${l.lesson}»${l.subject ? ` (${l.subject})` : ""} ثم حل كويزاً قصيراً`);
  if (!steps.length) steps.push(myPts > 0 ? "مستواك ثابت — تحدَّ نفسك بهدف نقاط أعلى هذا الأسبوع 🎯" : "ابدأ بأول امتحان لتظهر خطتك هنا 📝");

  return NextResponse.json({ ok: true, rank, of, groupAvg, myPts, groupName, lessons, steps });
}
