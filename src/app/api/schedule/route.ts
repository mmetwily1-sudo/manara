import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R, staffScope } from "@/lib/permissions";

/** GET /api/schedule — الجدول الأسبوعي + كشف تعارضات (نفس المدرس/الفرع بتوقيت متقاطع) */
export async function GET() {
  const res = await requireTeacher(R.groupsRead);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const scope = await staffScope(admin, tid, res.ctx.userRow.role, res.ctx.userRow.id);
  const { data: groups } = await admin.from("groups")
    .select("id,name,grade_level,subject,schedule,branch_id,teacher_id,branches(name)")
    .eq("tenant_id", tid).order("created_at", { ascending: true }).limit(200);
  const visible = scope.groupIds ? ((groups ?? []) as any[]).filter((g) => scope.groupIds!.includes(g.id)) : ((groups ?? []) as any[]);

  const slots: { group: string; weekday: number; start: string; end: string; branch: string; teacher: string; teacherId: string | null; branchId: string | null }[] = [];
  visible.forEach((g: any) => {
    ((g.schedule ?? []) as any[]).forEach((s: any) => {
      slots.push({
        group: g.name, weekday: Number(s.weekday), start: String(s.start ?? ""), end: String(s.end ?? ""),
        branch: (g.branches as any)?.name ?? "الرئيسي", teacher: "", teacherId: g.teacher_id ?? null, branchId: g.branch_id ?? null,
      });
    });
  });
  // أسماء المدرسين
  const tids: string[] = [];
  slots.forEach((s) => { if (s.teacherId && !tids.includes(s.teacherId)) tids.push(s.teacherId); });
  if (tids.length) {
    const { data: st } = await admin.from("users").select("id,full_name").in("id", tids);
    const nm = new Map(((st ?? []) as any[]).map((u: any) => [u.id, u.full_name]));
    slots.forEach((s) => { s.teacher = (s.teacherId && nm.get(s.teacherId)) || "—"; });
  }
  // تعارض: نفس اليوم + تداخل وقت + (نفس المدرس أو نفس الفرع)
  const conflicts: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      if (a.weekday !== b.weekday || !a.start || !b.start) continue;
      const overlap = a.start < b.end && b.start < a.end;
      if (!overlap) continue;
      if (a.teacherId && a.teacherId === b.teacherId) conflicts.push(`المدرس واحد: «${a.group}» × «${b.group}» (${a.start}-${a.end})`);
      else if (a.branchId && a.branchId === b.branchId) conflicts.push(`نفس الفرع (${a.branch}): «${a.group}» × «${b.group}» (${a.start}-${a.end})`);
    }
  }
  const byDay: Record<number, typeof slots> = {};
  slots.forEach((s) => { (byDay[s.weekday] ??= []).push(s); });
  Object.values(byDay).forEach((arr) => arr.sort((x, y) => x.start.localeCompare(y.start)));
  const uniq: string[] = [];
  conflicts.forEach((c) => { if (!uniq.includes(c)) uniq.push(c); });
  return NextResponse.json({ ok: true, byDay, conflicts: uniq.slice(0, 20) });
}
