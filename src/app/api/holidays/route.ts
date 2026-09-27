import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/holidays — الإجازات الرسمية (طاقم) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin", "supervisor", "assistant", "accountant"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("holidays").select("id,holiday_date,title")
    .eq("tenant_id", res.ctx.tenantId).order("holiday_date", { ascending: true }).limit(100);
  return NextResponse.json({ ok: true, holidays: data ?? [] });
}

/** POST /api/holidays {holiday_date, title?} — إضافة إجازة (مالك) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b?.holiday_date ?? ""))) {
    return NextResponse.json({ ok: false, error: "bad_date" }, { status: 400 });
  }
  const { data, error } = await res.ctx.admin.from("holidays").insert({
    tenant_id: res.ctx.tenantId, holiday_date: b.holiday_date,
    title: String(b?.title ?? "").trim().slice(0, 120),
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("holiday-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** DELETE /api/holidays?id= — حذف إجازة (مالك) */
export async function DELETE(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  const { error } = await res.ctx.admin.from("holidays").delete().eq("id", id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("holiday-delete", error);
  return NextResponse.json({ ok: true });
}
