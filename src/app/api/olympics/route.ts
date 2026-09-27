import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/olympics — أوائل السنتر: أعلى متوسط (3+ محاولات) + لوحة شرف */
export async function GET() {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: atts } = await admin.from("exam_attempts").select("student_id,score,exam_id")
    .eq("tenant_id", tid).order("submitted_at", { ascending: false }).limit(5000);
  const byExam: Record<string, number> = {};
  const per: Record<string, number[]> = {};
  for (const a of (atts ?? []) as any[]) {
    if (!(a.exam_id in byExam)) {
      const { data: qs } = await admin.from("exam_questions").select("marks").eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(200);
      byExam[a.exam_id] = ((qs ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 0), 0);
    }
    const t = byExam[a.exam_id];
    if (t > 0) (per[a.student_id] ??= []).push((Number(a.score ?? 0) / t) * 100);
  }
  const ranked = Object.entries(per).filter(([, v]) => v.length >= 3)
    .map(([sid, v]) => ({ sid, avg: Math.round(v.reduce((s, x) => s + x, 0) / v.length), n: v.length }))
    .sort((a, b) => b.avg - a.avg).slice(0, 10);
  let names: Record<string, string> = {};
  if (ranked.length) {
    const { data: st } = await admin.from("users").select("id,full_name").in("id", ranked.map((r) => r.sid));
    (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
  }
  const medals = ["🥇", "🥈", "🥉"];
  return NextResponse.json({
    ok: true,
    hall: ranked.map((r, i) => ({
      rank: i + 1, medal: medals[i] ?? null,
      name: String(names[r.sid] ?? "طالب").split(/\s+/)[0] + " " + (String(names[r.sid] ?? "").split(/\s+/)[1]?.[0] ?? "") + ".",
      avg: r.avg, exams: r.n,
    })),
  });
}
