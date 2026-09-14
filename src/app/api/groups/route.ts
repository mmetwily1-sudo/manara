import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/groups — مجموعات السنتر مع عدد الطلاب */
export async function GET() {
  const res = await requireTeacher();
  if ("error" in res) return res.error;
  const { ctx } = res;

  const { data: groups, error } = await ctx.admin
    .from("groups")
    .select("id,name,grade_level,subject,monthly_fee,schedule,created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: enrolls } = await ctx.admin
    .from("enrollments")
    .select("group_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "active");
  const counts: Record<string, number> = {};
  (enrolls ?? []).forEach((e: any) => { counts[e.group_id] = (counts[e.group_id] ?? 0) + 1; });

  return NextResponse.json({
    ok: true,
    groups: (groups ?? []).map((g: any) => ({ ...g, students_count: counts[g.id] ?? 0 })),
  });
}

/** POST /api/groups — إنشاء مجموعة جديدة */
export async function POST(req: Request) {
  const res = await requireTeacher();
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null as any);
  const name = (body?.name ?? "").trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  const { data, error } = await ctx.admin.from("groups").insert({
    tenant_id: ctx.tenantId,
    teacher_id: ctx.userRow.id,
    name,
    grade_level: (body?.grade_level ?? "").trim() || null,
    subject: (body?.subject ?? "").trim() || null,
    monthly_fee: Number(body?.monthly_fee ?? 0) || 0,
    schedule: Array.isArray(body?.schedule) ? body.schedule : [],
  }).select("id,name").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, group: data });
}

/** DELETE /api/groups?id= — حذف مجموعة (يحذف تسجيلاتها تبعياً) */
export async function DELETE(req: Request) {
  const res = await requireTeacher();
  if ("error" in res) return res.error;
  const { ctx } = res;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const { error } = await ctx.admin.from("groups").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
