import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** GET /api/me/assignments — واجبات مجموعاتي + حالة تسليمي (طالب). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin
    .from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;

  const { data: enrolls } = await admin
    .from("enrollments").select("group_id").eq("tenant_id", tid).eq("student_id", sid).eq("status", "active");
  const gids = ((enrolls ?? []) as any[]).map((e) => e.group_id);
  if (!gids.length) return NextResponse.json({ ok: true, assignments: [] });

  const { data: list } = await admin
    .from("assignments")
    .select("id,group_id,title,description,due_at,max_score,allow_late,created_at,groups(name)")
    .eq("tenant_id", tid)
    .in("group_id", gids)
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = ((list ?? []) as any[]).map((a) => a.id);
  let mine: Record<string, any> = {};
  if (ids.length) {
    const { data: subs } = await admin
      .from("submissions").select("assignment_id,score,feedback_text,status,submitted_at")
      .eq("tenant_id", tid).eq("student_id", sid).in("assignment_id", ids);
    for (const s of (subs ?? []) as any[]) mine[s.assignment_id] = s;
  }
  const now = Date.now();
  return NextResponse.json({
    ok: true,
    assignments: ((list ?? []) as any[]).map((a) => {
      const due = a.due_at ? new Date(a.due_at).getTime() : null;
      return {
        ...a,
        group_name: (a.groups as any)?.name ?? null,
        submission: mine[a.id] ?? null,
        overdue: due !== null && due < now && !mine[a.id],
      };
    }),
  });
}
