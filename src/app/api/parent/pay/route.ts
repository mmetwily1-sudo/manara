import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isPaymobLive, createIntention } from "@/lib/paymob";
import { createHash } from "crypto";

/** POST /api/parent/pay { invoice_id, method: card|wallet } — دفع فاتورة ولي أمر */
export async function POST(req: Request) {
  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const token = req.headers.get("x-parent-token");
  if (!token) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const tokenHash = require("crypto").createHash("sha256").update("parent:" + token).digest("hex");
  const { data: sess } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    .from("parent_portal_sessions").select("id,student_id,tenant_id").eq("token_hash", require("crypto").createHash("sha256").update("parent:" + req.headers.get("x-parent-token")).digest("hex")).limit(1).single();
  if (!sess) return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });

  const tid = (sess as any).tenant_id;
  const b = await req.json().catch(() => ({} as any));
  const invoiceId = String(b?.invoice_id ?? "");
  const method = b?.method === "wallet" ? "wallet" : "card";
  if (!invoiceId) return NextResponse.json({ ok: false, error: "invoice_required" }, { status: 400 });

  if (!isPaymobLive()) return NextResponse.json({ ok: false, error: "not_configured", message: "الدفع الإلكتروني غير مفعّل بعد." }, { status: 400 });

  const { data: inv } = await adminClient.from("invoices").select("id,amount,paid").eq("id", invoiceId).eq("tenant_id", (sess as any).tenant_id).single();
  if (!inv) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const due = Math.max(0, Number((inv as any).amount ?? 0) - Number((inv as any).paid ?? 0));
  if (due <= 0) return NextResponse.json({ ok: false, error: "already_paid" }, { status: 400 });

  const { data: t } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    .from("tenants").select("name,settings").eq("id", (sess as any).tenant_id).single();
  const merchantOrderId = `parent-${(sess as any).tenant_id.slice(0,8)}-${Date.now()}`;
  const { iframeUrl } = await createIntention({
    amountEgp: due,
    merchantOrderId: `${merchantOrderId}:${invoiceId}`,
    customerName: String((t as any)?.name ?? "ولي أمر"),
    customerPhone: String((t as any)?.settings?.owner_phone ?? ""),
    method: method === "wallet" ? "wallet" : "card",
  });
  await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    .from("invoices").update({ paymob_order_id: String(invoiceId) }).eq("id", invoiceId);
  return NextResponse.json({ ok: true, iframe_url: iframeUrl });
}