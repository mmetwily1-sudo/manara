import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/branches — فروع السنتر (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("branches").select("id,name,address,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: true });
  return NextResponse.json({ ok: true, branches: data ?? [] });
}

/** POST /api/branches {name, address?} — فرع جديد (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const body = await req.json().catch(() => ({} as any));
  const name = String(body?.name ?? "").trim().slice(0, 80);
  if (name.length < 2) return NextResponse.json({ ok: false, error: "bad_name" }, { status: 400 });
  const { data, error } = await res.ctx.admin.from("branches")
    .insert({ tenant_id: res.ctx.tenantId, name, address: String(body?.address ?? "").trim().slice(0, 200) || null })
    .select("id,name").single();
  if (error) return dbFail("branch-create", error);
  return NextResponse.json({ ok: true, branch: data });
}

/** DELETE /api/branches?id= — حذف فرع (مالك فقط، يُحرر المرتبطين) */
export async function DELETE(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  const { error } = await res.ctx.admin.from("branches").delete().eq("id", id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("branch-delete", error);
  return NextResponse.json({ ok: true });
}
