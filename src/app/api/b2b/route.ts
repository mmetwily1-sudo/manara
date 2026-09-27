import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/b2b — عقود المدارس والشركات (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("b2b_contracts")
    .select("id,org_name,contact,value,start_date,end_date,notes,status,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ ok: true, contracts: data ?? [] });
}

/** POST /api/b2b {org_name, contact?, value?, start_date?, end_date?, notes?} — عقد جديد */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const org = String(b?.org_name ?? "").trim().slice(0, 150);
  if (!org) return NextResponse.json({ ok: false, error: "org_required" }, { status: 400 });
  const { data, error } = await res.ctx.admin.from("b2b_contracts").insert({
    tenant_id: res.ctx.tenantId, org_name: org,
    contact: String(b?.contact ?? "").trim().slice(0, 150),
    value: Math.max(0, Number(b?.value) || 0),
    start_date: b?.start_date || null, end_date: b?.end_date || null,
    notes: String(b?.notes ?? "").trim().slice(0, 1000),
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("b2b-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/b2b {id, status} — إنهاء/إلغاء عقد */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["active", "done", "cancelled"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("b2b_contracts").update({ status: b.status })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("b2b-update", error);
  return NextResponse.json({ ok: true });
}
