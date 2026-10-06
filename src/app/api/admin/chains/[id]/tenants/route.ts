import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** POST /api/admin/chains/[id]/tenants { tenantId } — ضمّ سنتر لسلسلة (مالك المنصة فقط) */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requirePlatformAdmin();
  if ("error" in res) return res.error;
  const { admin } = res.ctx;
  const body = await req.json().catch(() => null as any);
  const tenantId = String(body?.tenantId ?? "").trim();
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_required" }, { status: 400 });

  const { data: chain } = await admin.from("chains").select("id").eq("id", params.id).maybeSingle();
  if (!chain) return NextResponse.json({ ok: false, error: "chain_not_found" }, { status: 404 });

  const { error } = await admin.from("tenants").update({ chain_id: params.id }).eq("id", tenantId);
  if (error) return dbFail("chain_link_tenant", error);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/chains/[id]/tenants { tenantId } — فصل سنتر عن السلسلة */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const res = await requirePlatformAdmin();
  if ("error" in res) return res.error;
  const { admin } = res.ctx;
  const body = await req.json().catch(() => null as any);
  const tenantId = String(body?.tenantId ?? "").trim();
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_required" }, { status: 400 });

  // أمان: لا نفصل إلا سنتراً فعلاً تابعاً لهذه السلسلة (يمنع تعديل سنتر بسلسلة غير علاقة)
  const { error } = await admin.from("tenants").update({ chain_id: null })
    .eq("id", tenantId).eq("chain_id", params.id);
  if (error) return dbFail("chain_unlink_tenant", error);
  return NextResponse.json({ ok: true });
}
