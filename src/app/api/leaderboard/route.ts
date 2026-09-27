import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** إخفاء الاسم: الأول + أول حرف من الثاني */
function mask(name: string) {
  const parts = String(name ?? "طالب").trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "طالب";
  return `${parts[0]} ${parts[1][0]}•••`;
}

/** GET /api/leaderboard?group_id= — متصدرو مجموعة (أسماء مخفاة) أو السنتر كله */
export async function GET(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const groupId = new URL(req.url).searchParams.get("group_id");

  let ids: string[] | null = null;
  let groupName: string | null = null;
  if (groupId) {
    const { data: g } = await admin.from("groups").select("id,name").eq("id", groupId).eq("tenant_id", tid).single();
    if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 404 });
    groupName = (g as any).name;
    const { data: enr } = await admin.from("enrollments").select("student_id")
      .eq("tenant_id", tid).eq("group_id", groupId).eq("status", "active").limit(500);
    ids = ((enr ?? []) as any[]).map((e) => e.student_id);
    if (!ids.length) return NextResponse.json({ ok: true, group: groupName, leaders: [] });
  }
  let q = admin.from("users").select("id,full_name,points").eq("tenant_id", tid).eq("role", "student")
    .order("points", { ascending: false }).limit(10);
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  const medals = ["🥇", "🥈", "🥉"];
  return NextResponse.json({
    ok: true, group: groupName,
    leaders: ((data ?? []) as any[]).map((s, i) => ({
      rank: i + 1, medal: medals[i] ?? null, name: mask(s.full_name), points: Number(s.points ?? 0) || 0,
    })),
  });
}
