import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/coupons — كوبونات السنتر (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("coupons")
    .select("id,code,pct,max_uses,used,expires_at,is_active,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ ok: true, coupons: data ?? [] });
}

/** POST /api/coupons {code, pct, max_uses?, expires_at?} — كوبون جديد */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const code = String(b?.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9\u0621-\u064A-]/g, "").slice(0, 24);
  const pct = Number(b?.pct);
  if (!code || !Number.isInteger(pct) || pct <= 0 || pct > 90) {
    return NextResponse.json({ ok: false, error: "bad_coupon" }, { status: 400 });
  }
  const { data, error } = await res.ctx.admin.from("coupons").insert({
    tenant_id: res.ctx.tenantId, code, pct,
    max_uses: Math.max(1, Number(b?.max_uses) || 100),
    expires_at: /^\d{4}-\d{2}-\d{2}$/.test(String(b?.expires_at ?? "")) ? b.expires_at : null,
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("coupon-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id, code, pct });
}

/** PATCH /api/coupons {id, is_active} — تفعيل/إيقاف */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const { error } = await res.ctx.admin.from("coupons").update({ is_active: !!b?.is_active })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("coupon-update", error);
  return NextResponse.json({ ok: true });
}
