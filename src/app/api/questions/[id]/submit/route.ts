import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/questions/[id]/submit — المعلم يرشح سؤاله الخاص للبنك المركزي.
 * يتحول لـ pending (يبقى يعمل في بنكه)، والإدارة تراجع ثم تنسخ نسخة عامة.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content, { req: _req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;

  const { data: q } = await admin
    .from("questions")
    .select("id,status,visibility")
    .eq("id", params.id)
    .eq("tenant_id", res.ctx.tenantId)
    .single();
  if (!q) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if ((q as any).visibility !== "private") {
    return NextResponse.json({ ok: false, error: "already_shared" }, { status: 400 });
  }
  if ((q as any).status === "pending") {
    return NextResponse.json({ ok: true, already: true });
  }
  const { error } = await admin
    .from("questions")
    .update({ status: "pending" })
    .eq("id", params.id)
    .eq("tenant_id", res.ctx.tenantId);
  if (error) {
    if ((error as any).code === "42703" || (error.message ?? "").includes("status")) {
      return NextResponse.json(
        { ok: false, error: "sharing_not_ready", message: "نظام المشاركة غير مفعّل بعد — نفّذ ترحيل 005" },
        { status: 500 }
      );
    }
    return dbFail("question-submit", error);
  }
  return NextResponse.json({ ok: true, pending: true });
}
