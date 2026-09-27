import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/battles?exam_id=&a=&b= — معركة مجموعتين في امتحان: متوسط كل منهما والفائز */
export async function GET(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const q = new URL(req.url).searchParams;
  const examId = q.get("exam_id") ?? "";
  const a = q.get("a") ?? "";
  const b = q.get("b") ?? "";
  if (!examId || !a || !b || a === b) return NextResponse.json({ ok: false, error: "need_exam_and_two_groups" }, { status: 400 });

  const { data: ex } = await admin.from("exams").select("id,title").eq("id", examId).eq("tenant_id", tid).single();
  if (!ex) return NextResponse.json({ ok: false, error: "bad_exam" }, { status: 404 });
  const { data: qs } = await admin.from("exam_questions").select("marks").eq("tenant_id", tid).eq("exam_id", examId).limit(200);
  const total = ((qs ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 0), 0);
  const { data: atts } = await admin.from("exam_attempts").select("student_id,score")
    .eq("tenant_id", tid).eq("exam_id", examId).limit(2000);
  const { data: enr } = await admin.from("enrollments").select("student_id,group_id,groups(name)")
    .eq("tenant_id", tid).eq("status", "active").in("group_id", [a, b]).limit(2000);
  const inA = new Set(((enr ?? []) as any[]).filter((e) => e.group_id === a).map((e) => e.student_id));
  const inB = new Set(((enr ?? []) as any[]).filter((e) => e.group_id === b).map((e) => e.student_id));
  const gname = (gid: string) => ((enr ?? []) as any[]).find((e) => e.group_id === gid)?.groups?.name ?? "مجموعة";

  const agg = (set: Set<string>) => {
    const rows = ((atts ?? []) as any[]).filter((x) => set.has(x.student_id));
    const avg = rows.length && total > 0 ? Math.round(rows.reduce((s, x) => s + (Number(x.score ?? 0) / total) * 100, 0) / rows.length) : null;
    return { count: rows.length, avg };
  };
  const ra = agg(inA), rb = agg(inB);
  const winner = ra.avg === null && rb.avg === null ? null : (ra.avg ?? -1) >= (rb.avg ?? -1) ? "a" : "b";
  return NextResponse.json({
    ok: true, exam: (ex as any).title,
    a: { name: gname(a), ...ra }, b: { name: gname(b), ...rb }, winner,
  });
}
