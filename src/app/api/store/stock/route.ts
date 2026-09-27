import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** PATCH /api/store/stock {product_id, stock_qty} — ضبط مخزون (-1 = غير محدود) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const qty = Number(b?.stock_qty);
  if (!b?.product_id || !Number.isInteger(qty) || qty < -1 || qty > 100000) {
    return NextResponse.json({ ok: false, error: "bad_qty" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("products").update({ stock_qty: qty })
    .eq("id", b.product_id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("stock", error);
  return NextResponse.json({ ok: true, stock_qty: qty });
}
