import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/**
 * GET /api/me/gamification — التحفيز محسوب من البيانات الفعلية (بدون جداول جديدة):
 * streak أيام النشاط المتتالية + أوسمة مستحقة + نقاط + متصدرون.
 * يوم نشط = حضور مسجل / تسليم واجب / محاولة امتحان.
 */

import { streakOf, trophiesFor, dayKey } from "@/lib/gamification";

export async function GET(req: Request) {
  const { resolveMeStudent } = await import("@/lib/student-auth");
  const ctx = await resolveMeStudent(req);
  if ("error" in ctx) return ctx.error;
  const { admin, tenantId, studentId } = ctx;
  const { data: urow } = await admin
    .from("users").select("id,tenant_id,full_name,points").eq("id", studentId).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;

  const [{ data: att }, { data: subs }, { data: attempts }] = await Promise.all([
    admin.from("attendance").select("status,recorded_at").eq("tenant_id", tid).eq("student_id", sid).limit(500),
    admin.from("submissions").select("status,score,submitted_at").eq("tenant_id", tid).eq("student_id", sid).limit(200),
    admin.from("exam_attempts").select("score,submitted_at,exams(total_marks)").eq("tenant_id", tid).eq("student_id", sid).limit(200),
  ]);

  const days = new Set<string>();
  for (const r of (att ?? []) as any[]) if (r.status === "present") days.add(dayKey(new Date(r.recorded_at)));
  for (const r of (subs ?? []) as any[]) days.add(dayKey(new Date(r.submitted_at)));
  for (const r of (attempts ?? []) as any[]) days.add(dayKey(new Date(r.submitted_at)));

  const streak = streakOf(days);
  const graded = ((subs ?? []) as any[]).filter((s) => s.status === "graded");
  let bestPct: number | null = null;
  let pctSum = 0, pctN = 0;
  for (const a of (attempts ?? []) as any[]) {
    const total = Number((a.exams as any)?.total_marks ?? 0);
    if (total > 0) {
      const pct = (Number(a.score ?? 0) / total) * 100;
      bestPct = bestPct === null ? pct : Math.max(bestPct, pct);
      pctSum += pct; pctN++;
    }
  }
  const attRows = ((att ?? []) as any[]);
  const presentRate = attRows.length >= 5
    ? (attRows.filter((r) => r.status === "present").length / attRows.length) * 100
    : null;

  const trophies = trophiesFor({ streak, activeDays: days.size, gradedCount: graded.length, bestPct, presentRate });
  // النقاط من الدفتر التراكمي (يُمنح عند الأحداث)، لا من الحساب اللحظي
  const points = Number((urow as any).points ?? 0) || 0;

  // المتصدرون: دفتر النقاط مباشرة (استعلام واحد رخيص)
  let leaders: { name: string; points: number; me: boolean }[] = [];
  try {
    const { data: students } = await admin.from("users").select("id,full_name,points")
      .eq("tenant_id", tid).eq("role", "student").order("points", { ascending: false }).limit(10);
    leaders = ((students ?? []) as any[]).map((s) => ({
      name: s.full_name ?? "طالب", points: Number(s.points ?? 0) || 0, me: s.id === sid,
    }));
  } catch {}

  return NextResponse.json({
    ok: true,
    me: { name: (urow as any).full_name, streak, activeDays: days.size, points, trophies },
    leaders,
  });
}
