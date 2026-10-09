import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/assignments/[id] — تفاصيل الواجب + التسليمات (معلم). DELETE — حذف الواجب وتسليماته. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { data: a } = await admin
    .from("assignments")
    .select("id,group_id,title,description,due_at,max_score,allow_late,created_at,groups(name)")
    .eq("id", params.id)
    .eq("tenant_id", tid)
    .single();
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: subs, error } = await admin
    .from("submissions")
    .select("id,student_id,score,feedback_text,status,submitted_at,file_urls,users(full_name)")
    .eq("assignment_id", params.id)
    .eq("tenant_id", tid)
    .order("submitted_at", { ascending: true });
  if (error) return dbFail("assignment-detail", error);

  return NextResponse.json({
    ok: true,
    assignment: { ...(a as any), group_name: ((a as any).groups as any)?.name ?? null },
    submissions: ((subs ?? []) as any[]).map((s) => ({
      ...s,
      student_name: (s.users as any)?.full_name ?? "طالب",
    })),
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content, { req: _req });
  if ("error" in res) return res.error;
  const admin = adminClient();
  const { error } = await admin.from("assignments").delete().eq("id", params.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("assignment-delete", error);
  return NextResponse.json({ ok: true });
}
