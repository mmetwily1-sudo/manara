import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/team/support-flags — مدرسون يحتاجون دعماً: تحصيل مجموعاتهم <50% أو بلا تحضير 14 يوماً (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const cutoff = new Date(Date.now() - 14 * 864e5).toISOString();

  const [{ data: groups }, { data: enr }, { data: pay }, { data: att }, { data: staff }] = await Promise.all([
    admin.from("groups").select("id,name,monthly_fee,teacher_id").eq("tenant_id", tid).limit(200),
    admin.from("enrollments").select("group_id,student_id").eq("tenant_id", tid).eq("status", "active").limit(3000),
    admin.from("payments").select("amount,group_id").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", cutoff).limit(3000),
    admin.from("attendance").select("id,recorded_by").eq("tenant_id", tid).gte("created_at", cutoff).limit(5000),
    admin.from("users").select("id,full_name").eq("tenant_id", tid).in("role", ["supervisor", "assistant"]).limit(100),
  ]);
  const markedBy = new Set(((att ?? []) as any[]).map((a) => a.recorded_by).filter(Boolean));
  const flags: { teacher: string; reason: string }[] = [];
  const byTeacher: Record<string, any[]> = {};
  ((groups ?? []) as any[]).forEach((g) => {
    if (!g.teacher_id) return;
    (byTeacher[g.teacher_id] ??= []).push(g);
  });
  for (const [tid2, gs] of Object.entries(byTeacher)) {
    const name = ((staff ?? []) as any[]).find((s) => s.id === tid2)?.full_name ?? "مدرس";
    let exp = 0, col = 0;
    gs.forEach((g) => {
      const n = new Set(((enr ?? []) as any[]).filter((e) => e.group_id === g.id).map((e) => e.student_id)).size;
      exp += n * Number(g.monthly_fee ?? 0);
      col += ((pay ?? []) as any[]).filter((p) => p.group_id === g.id).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    });
    const reasons: string[] = [];
    if (exp > 0 && col / exp < 0.5) reasons.push(`تحصيل مجموعاته ${Math.round((col / exp) * 100)}% فقط من المتوقع`);
    if (!markedBy.has(tid2)) reasons.push("لم يسجل أي تحضير منذ 14 يوماً");
    if (reasons.length) flags.push({ teacher: name, reason: reasons.join(" · ") });
  }
  return NextResponse.json({ ok: true, flags: flags.slice(0, 20) });
}
