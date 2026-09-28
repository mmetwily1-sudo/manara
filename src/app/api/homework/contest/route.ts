import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/homework/contest — سباق الواجبات الأسبوعي بين المجموعات (نسبة التسليم) */
export async function GET() {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: groups }, { data: enr }, { data: subs }] = await Promise.all([
    admin.from("groups").select("id,name").eq("tenant_id", tid).limit(100),
    admin.from("enrollments").select("group_id,student_id").eq("tenant_id", tid).eq("status", "active").limit(3000),
    admin.from("submissions").select("student_id,assignment_id,assignments(group_id)")
      .eq("tenant_id", tid).gte("submitted_at", weekAgo).limit(3000),
  ]);
  const members: Record<string, Set<string>> = {};
  ((enr ?? []) as any[]).forEach((e) => {
    (members[e.group_id] ??= new Set()).add(e.student_id);
  });
  const submitted: Record<string, Set<string>> = {};
  ((subs ?? []) as any[]).forEach((s) => {
    const gid = (s.assignments as any)?.group_id;
    if (gid) (submitted[gid] ??= new Set()).add(s.student_id);
  });
  const rows = ((groups ?? []) as any[])
    .map((g) => {
      const m = members[g.id]?.size ?? 0;
      const s = submitted[g.id]?.size ?? 0;
      return { id: g.id, name: g.name, members: m, submitted: s, rate: m ? Math.round((s / m) * 100) : 0 };
    })
    .filter((r) => r.members > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);
  return NextResponse.json({ ok: true, contest: rows });
}
