import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R, staffScope } from "@/lib/permissions";

/** POST /api/sessions — إنشاء أو جلب جلسة اليوم لمجموعة (طاقم الفرع لمجموعات فرعه) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null as any);
  const groupId = (body?.groupId ?? "").trim();
  if (!groupId) return NextResponse.json({ ok: false, error: "missing_group" }, { status: 400 });

  const { data: g } = await ctx.admin
    .from("groups")
    .select("id,name")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });
  const scope = await staffScope(ctx.admin, ctx.tenantId, res.ctx.userRow.role, res.ctx.userRow.id);
  if (scope.groupIds && !scope.groupIds.includes(groupId)) {
    return NextResponse.json({ ok: false, error: "wrong_branch" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await ctx.admin
    .from("sessions")
    .select("id,topic,status")
    .eq("tenant_id", ctx.tenantId)
    .eq("group_id", groupId)
    .eq("session_date", today)
    .limit(1)
    .single();

  if (existing) return NextResponse.json({ ok: true, session: existing, created: false });

  const { data: created, error } = await ctx.admin.from("sessions").insert({
    tenant_id: ctx.tenantId,
    group_id: groupId,
    session_date: today,
    topic: null,
    status: "scheduled",
  }).select("id,topic,status").single();

  if (error || !created) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, session: created, created: true });
}
