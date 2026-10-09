import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/bank — كشف البنك + اقتراحات مطابقة (فواتير غير مدفوعة بنفس المبلغ) */
export async function GET() {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const [{ data: stmts }, { data: invs }] = await Promise.all([
    admin.from("bank_statements").select("id,stmt_date,amount,reference,status,matched_invoice_id")
      .eq("tenant_id", tid).order("stmt_date", { ascending: false }).limit(200),
    admin.from("invoices").select("id,student_id,period,amount,paid")
      .eq("tenant_id", tid).neq("status", "paid").limit(1000),
  ]);
  const byAmount: Record<string, any[]> = {};
  ((invs ?? []) as any[]).forEach((v) => {
    const rest = Number(v.amount ?? 0) - Number(v.paid ?? 0);
    if (rest > 0) ((byAmount[String(rest)] ??= []).push({ ...v, rest }));
  });
  const sids = Array.from(new Set(((invs ?? []) as any[]).map((v) => v.student_id)));
  let names: Record<string, string> = {};
  if (sids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  return NextResponse.json({
    ok: true,
    rows: ((stmts ?? []) as any[]).map((s) => ({
      ...s,
      suggestions: (byAmount[String(Number(s.amount ?? 0))] ?? []).slice(0, 3)
        .map((v: any) => ({ ...v, student: names[v.student_id] ?? "" })),
    })),
  });
}

/** POST /api/bank {stmt_date, amount, reference?} — حركة بنكية يدوية */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const amount = Number(b?.amount ?? NaN);
  if (!b?.stmt_date || !(amount > 0)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("bank_statements").insert({
    tenant_id: res.ctx.tenantId, stmt_date: b.stmt_date, amount,
    reference: String(b?.reference ?? "").slice(0, 120),
  });
  if (error) return dbFail("bank-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/bank {id, invoice_id?|null} — ربط بفاتورة (أو فك الربط) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.billingWrite, { req: req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  if (b?.invoice_id) {
    const { data: inv } = await admin.from("invoices").select("id").eq("id", b.invoice_id).eq("tenant_id", tid).single();
    if (!inv) return NextResponse.json({ ok: false, error: "bad_invoice" }, { status: 400 });
    const { error } = await admin.from("bank_statements")
      .update({ status: "matched", matched_invoice_id: b.invoice_id }).eq("id", b.id).eq("tenant_id", tid);
    if (error) return dbFail("bank-match", error);
  } else {
    const { error } = await admin.from("bank_statements")
      .update({ status: "unmatched", matched_invoice_id: null }).eq("id", b.id).eq("tenant_id", tid);
    if (error) return dbFail("bank-unmatch", error);
  }
  return NextResponse.json({ ok: true });
}
