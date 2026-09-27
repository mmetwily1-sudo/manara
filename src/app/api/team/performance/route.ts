import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/team/performance — تقييم أداء الطاقم آخر 30 يوماً: مهام منجزة + تحضير مسجل (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: staff }, { data: tasks }, { data: att }] = await Promise.all([
    admin.from("users").select("id,full_name,role").eq("tenant_id", tid).neq("role", "student").limit(100),
    admin.from("staff_tasks").select("assignee_id,status").eq("tenant_id", tid).gte("created_at", monthAgo).limit(1000),
    admin.from("attendance").select("recorded_by").eq("tenant_id", tid).gte("created_at", monthAgo).limit(5000),
  ]);
  const doneBy: Record<string, number> = {};
  const openBy: Record<string, number> = {};
  ((tasks ?? []) as any[]).forEach((t) => {
    if (!t.assignee_id) return;
    if (t.status === "done") doneBy[t.assignee_id] = (doneBy[t.assignee_id] ?? 0) + 1;
    else if (t.status === "open") openBy[t.assignee_id] = (openBy[t.assignee_id] ?? 0) + 1;
  });
  const attBy: Record<string, number> = {};
  ((att ?? []) as any[]).forEach((a: any) => {
    if (a.recorded_by) attBy[a.recorded_by] = (attBy[a.recorded_by] ?? 0) + 1;
  });
  const roleAr: Record<string, string> = { teacher_admin: "مالك", supervisor: "مشرف", assistant: "مساعد", accountant: "محاسب" };
  return NextResponse.json({
    ok: true,
    staff: ((staff ?? []) as any[]).map((s) => ({
      id: s.id, name: s.full_name, role: roleAr[s.role] ?? s.role,
      tasksDone: doneBy[s.id] ?? 0, tasksOpen: openBy[s.id] ?? 0, attendanceMarked: attBy[s.id] ?? 0,
      score: (doneBy[s.id] ?? 0) * 10 + Math.min(50, attBy[s.id] ?? 0),
    })).sort((a, b) => b.score - a.score),
  });
}
