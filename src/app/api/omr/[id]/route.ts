import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

/** GET /api/omr/[id] — الورقة + نتائجها. DELETE — حذف الورقة ونتائجها. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  try {
    const { data: sheet } = await admin.from("omr_sheets").select("*").eq("id", params.id).eq("tenant_id", tid).single();
    if (!sheet) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const { data: results, error } = await admin.from("omr_results")
      .select("id,student_name,score,total,needs_review,answers,created_at")
      .eq("sheet_id", params.id).eq("tenant_id", tid).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ ok: true, sheet, results: results ?? [] });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 400 });
    return dbFail("omr-detail", e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const { error } = await admin.from("omr_sheets").delete().eq("id", params.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("omr-delete", error);
  return NextResponse.json({ ok: true });
}
