import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/students/transfer {student_id, to_group_id} — نقل طالب لمجموعة/فرع آخر (مالك فقط).
 * يُعطّل تسجيلاته النشطة + تسجيل جديد + تدقيق + فحص السعة.
 */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: st } = await sb.from("users").select("id,full_name").eq("id", b?.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { data: g } = await sb.from("groups").select("id,name,capacity,branch_id,branches(name)")
    .eq("id", b?.to_group_id).eq("tenant_id", tid).single();
  if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });
  const { isGroupFull } = await import("@/lib/capacity");
  if (await isGroupFull(sb, tid, (g as any).id)) {
    return NextResponse.json({ ok: false, error: "group_full" }, { status: 409 });
  }
  const { data: old } = await sb.from("enrollments").select("group_id,groups(name)")
    .eq("tenant_id", tid).eq("student_id", (st as any).id).eq("status", "active").limit(20);
  const { error: tErr } = await sb.from("enrollments").update({ status: "transferred" })
    .eq("tenant_id", tid).eq("student_id", (st as any).id).eq("status", "active");
  if (tErr) {
    // قيد قديم يقبل inactive فقط — بديل آمن
    await sb.from("enrollments").update({ status: "inactive" })
      .eq("tenant_id", tid).eq("student_id", (st as any).id).eq("status", "active");
  }
  const { error } = await sb.from("enrollments").insert({
    tenant_id: tid, student_id: (st as any).id, group_id: (g as any).id, status: "active",
  });
  if (error) return dbFail("transfer", error);
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "student:transfer", entity_type: "student", entity_id: (st as any).id,
      details: {
        from: ((old ?? []) as any[]).map((e) => (e.groups as any)?.name ?? e.group_id),
        to: (g as any).name, branch: ((g as any).branches as any)?.name ?? null,
      },
    });
  } catch {}
  return NextResponse.json({ ok: true, to: (g as any).name });
}
