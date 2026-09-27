import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/reports/profitability — ربحية فرع/مجموعة/مدرس آخر 30 يوماً (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: branches }, { data: groups }, { data: enr }, { data: pay }, { data: inv }, { data: staff }] = await Promise.all([
    admin.from("branches").select("id,name").eq("tenant_id", tid).limit(50),
    admin.from("groups").select("id,name,monthly_fee,branch_id,teacher_id").eq("tenant_id", tid).limit(200),
    admin.from("enrollments").select("group_id,student_id").eq("tenant_id", tid).eq("status", "active").limit(3000),
    admin.from("payments").select("amount,group_id").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", monthAgo).limit(3000),
    admin.from("invoices").select("group_id,amount,paid").eq("tenant_id", tid).neq("status", "paid").limit(2000),
    admin.from("users").select("id,full_name").eq("tenant_id", tid).in("role", ["teacher_admin", "supervisor", "assistant"]).limit(100),
  ]);
  const gs = (groups ?? []) as any[];
  const gmap = new Map(gs.map((g) => [g.id, g]));
  const bmap = new Map(((branches ?? []) as any[]).map((b: any) => [b.id, b.name]));
  const smap = new Map(((staff ?? []) as any[]).map((s: any) => [s.id, s.full_name]));

  const perGroup = gs.map((g) => {
    const students = new Set(((enr ?? []) as any[]).filter((e) => e.group_id === g.id).map((e) => e.student_id)).size;
    const collected = ((pay ?? []) as any[]).filter((p) => p.group_id === g.id).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const out = ((inv ?? []) as any[]).filter((x) => x.group_id === g.id).reduce((s, x) => s + Number(x.amount ?? 0) - Number(x.paid ?? 0), 0);
    const expected = students * Number(g.monthly_fee ?? 0);
    return {
      id: g.id, name: g.name, branch: bmap.get(g.branch_id) ?? "الرئيسي",
      teacher: smap.get(g.teacher_id) ?? "—", students, expected, collected,
      outstanding: Math.max(0, out), rate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
    };
  }).sort((a, b) => b.collected - a.collected);

  const perBranch: Record<string, { name: string; students: number; collected: number; outstanding: number }> = {};
  const seen = new Set<string>();
  perGroup.forEach((g) => {
    const b = perBranch[g.branch] ??= { name: g.branch, students: 0, collected: 0, outstanding: 0 };
    b.collected += g.collected; b.outstanding += g.outstanding;
  });
  ((enr ?? []) as any[]).forEach((e) => {
    const g = gmap.get(e.group_id);
    if (!g || seen.has(`${g.branch_id ?? "main"}:${e.student_id}`)) return;
    seen.add(`${g.branch_id ?? "main"}:${e.student_id}`);
    const b = perBranch[bmap.get(g.branch_id) ?? "الرئيسي"] ??= { name: bmap.get(g.branch_id) ?? "الرئيسي", students: 0, collected: 0, outstanding: 0 };
    b.students++;
  });

  const perTeacher: Record<string, { name: string; groups: number; students: number; collected: number }> = {};
  gs.forEach((g) => {
    const t = perTeacher[g.teacher_id ?? "?"] ??= { name: smap.get(g.teacher_id) ?? "—", groups: 0, students: 0, collected: 0 };
    t.groups++;
  });
  perGroup.forEach((g) => {
    const src = gs.find((x) => x.id === g.id);
    const t = perTeacher[src?.teacher_id ?? "?"];
    if (t) { t.students += g.students; t.collected += g.collected; }
  });

  const total = perGroup.reduce((s, g) => s + g.collected, 0);
  return NextResponse.json({
    ok: true, total,
    branches: Object.values(perBranch).sort((a, b) => b.collected - a.collected),
    groups: perGroup.slice(0, 50),
    teachers: Object.values(perTeacher).sort((a, b) => b.collected - a.collected),
  });
}
