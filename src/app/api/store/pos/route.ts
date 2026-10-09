import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/store/pos {items:[{product_id, qty}], student_id?} — بيع سريع (كاشير):
 * فحص مخزون + أوامر مدفوعة + خصم مخزون. stock_qty = -1 يعني غير محدود (رقمي).
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite, { req: req });
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const items = Array.isArray(b?.items) ? b.items.slice(0, 50) : [];
  if (!items.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const { data: st } = await sb.from("users").select("id").eq("id", b?.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "student_required" }, { status: 400 });
  const studentId = (st as any).id;
  const ids = Array.from(new Set(items.map((x: any) => String(x?.product_id ?? "")))).filter(Boolean);
  const { data: prods } = await sb.from("products").select("id,title,price,stock_qty,is_active")
    .eq("tenant_id", tid).in("id", ids);
  const pmap = new Map(((prods ?? []) as any[]).map((p) => [p.id, p]));

  let total = 0, sold = 0;
  const lacking: string[] = [];
  for (const it of items) {
    const p = pmap.get(String(it?.product_id ?? ""));
    const qty = Math.max(1, Math.min(99, Number(it?.qty) || 1));
    if (!p || !(p as any).is_active) { lacking.push(String(it?.product_id ?? "?")); continue; }
    const stock = Number((p as any).stock_qty ?? -1);
    if (stock >= 0 && stock < qty) { lacking.push((p as any).title); continue; }
    try {
      const rows = Array.from({ length: qty }, () => ({
        tenant_id: tid, product_id: (p as any).id, student_id: studentId, status: "confirmed",
      }));
      const { error } = await sb.from("orders").insert(rows);
      if (error) throw error;
      if (stock >= 0) {
        await sb.from("products").update({ stock_qty: stock - qty }).eq("id", (p as any).id).eq("tenant_id", tid);
      }
      total += Number((p as any).price ?? 0) * qty;
      sold += qty;
    } catch { lacking.push((p as any).title); }
  }
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "store:pos", entity_type: "order", entity_id: "pos",
      details: { sold, total, student: studentId },
    });
  } catch {}
  return NextResponse.json({ ok: true, sold, total, lacking });
}
