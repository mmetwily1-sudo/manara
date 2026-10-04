import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** GET /api/me/teachers — معلمو مجموعاتي (لطالب) لبدء محادثة */
export async function GET(req: Request) {
  const { resolveMeStudent } = await import("@/lib/student-auth");
  const ctx = await resolveMeStudent(req);
  if ("error" in ctx) return ctx.error;
  const { admin, tenantId, studentId } = ctx;
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("id", studentId).single();
  if (!urow || (urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  }
  const tid = (urow as any).tenant_id;
  const { data: enr } = await admin.from("enrollments").select("group_id").eq("tenant_id", tid)
    .eq("student_id", (urow as any).id).eq("status", "active").limit(50);
  const gids = ((enr ?? []) as any[]).map((e) => e.group_id);
  if (!gids.length) return NextResponse.json({ ok: true, teachers: [] });
  const { data: gs } = await admin.from("groups").select("teacher_id").eq("tenant_id", tid).in("id", gids).limit(50);
  const tids = ((gs ?? []) as any[]).map((g) => g.teacher_id).filter(Boolean);
  if (!tids.length) return NextResponse.json({ ok: true, teachers: [] });
  const { data: ts } = await admin.from("users").select("id,full_name").in("id", tids).limit(20);
  const seen: string[] = [];
  const out = ((ts ?? []) as any[]).filter((t) => {
    if (seen.includes(t.id)) return false;
    seen.push(t.id);
    return true;
  }).map((t) => ({ id: t.id, name: t.full_name }));
  return NextResponse.json({ ok: true, teachers: out });
}
