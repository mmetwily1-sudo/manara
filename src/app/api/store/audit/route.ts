import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/store/audit — آخر عمليات الجرد (معلم) */
export async function GET() {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: rows, error } = await admin.from("stock_audits")
    .select("id,product_id,system_qty,counted_qty,diff,applied,note,created_at")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100);
  if (error) return dbFail("audit-list", error);
  const pids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.product_id)));
  let titles: Record<string, string> = {};
  if (pids.length) {
    const { data: ps } = await admin.from("products").select("id,title").in("id", pids as string[]);
    (ps ?? []).forEach((p: any) => { titles[p.id] = p.title ?? ""; });
  }
  const [{ data: prods }] = await Promise.all([
    admin.from("products").select("id,title,stock_qty").eq("tenant_id", tid).eq("is_active", true).limit(200),
  ]);
  return NextResponse.json({
    ok: true,
    products: prods ?? [],
    rows: ((rows ?? []) as any[]).map((r) => ({ ...r, title: titles[r.product_id] ?? "" })),
  });
}

/** POST /api/store/audit {product_id, counted_qty, note?} — تسجيل عد (يحسب الفرق) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.attendance, { req: req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const counted = Number(b?.counted_qty ?? NaN);
  if (!b?.product_id || !(counted >= 0 && counted <= 1000000)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: p } = await admin.from("products").select("id,stock_qty")
    .eq("id", b.product_id).eq("tenant_id", tid).single();
  if (!p) return NextResponse.json({ ok: false, error: "bad_product" }, { status: 400 });
  const system = Number((p as any).stock_qty ?? 0);
  const { error } = await admin.from("stock_audits").insert({
    tenant_id: tid, product_id: (p as any).id, system_qty: system, counted_qty: counted,
    diff: counted - system, note: String(b?.note ?? "").slice(0, 200),
  });
  if (error) return dbFail("audit-create", error);
  return NextResponse.json({ ok: true, diff: counted - system });
}

/** PATCH /api/store/audit {id} — تطبيق العد على المخزون (مرة واحدة) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.attendance, { req: req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: a } = await admin.from("stock_audits").select("id,product_id,counted_qty,applied")
    .eq("id", b?.id).eq("tenant_id", tid).single();
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if ((a as any).applied) return NextResponse.json({ ok: false, error: "already" }, { status: 400 });
  const { error: ue } = await admin.from("products").update({ stock_qty: (a as any).counted_qty })
    .eq("id", (a as any).product_id).eq("tenant_id", tid);
  if (ue) return dbFail("audit-apply-stock", ue);
  const { error } = await admin.from("stock_audits").update({ applied: true })
    .eq("id", b.id).eq("tenant_id", tid);
  if (error) return dbFail("audit-apply", error);
  return NextResponse.json({ ok: true });
}
