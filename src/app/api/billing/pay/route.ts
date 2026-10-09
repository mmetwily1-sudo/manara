import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { isPaymobLive, createIntention, PLAN_PRICES } from "@/lib/paymob";
import { isMissingTable } from "@/lib/server-auth";

/** POST /api/billing/pay { plan: starter|pro|scale, yearly?: boolean, method?: card|wallet } — رابط دفع Paymob (معلم). */
export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  if (!isPaymobLive()) {
    return NextResponse.json({ ok: false, error: "not_configured", message: "الدفع الأونلاين غير مفعل بعد — تواصل واتساب للاشتراك." }, { status: 400 });
  }
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const body = await req.json().catch(() => ({} as any));
  const plan = String(body.plan ?? "");
  const yearly = body.yearly === true;
  const prices = PLAN_PRICES[plan];
  if (!prices) return NextResponse.json({ ok: false, error: "bad_plan" }, { status: 400 });
  const months = yearly ? 12 : 1;

  try {
    const { data: t } = await admin.from("tenants").select("name,settings").eq("id", tid).single();
    // خصم التجديد المبكر (5% شهري فقط): الأهلية من renewal_state لحظة الدفع — سيرفر-سايد
    // حصراً، والعميل لا يرسلها أبداً (منع انتحال الأهلية). السنوية مستثناة (خصمها الضمني ~17%).
    // القرار: كل دورة (حافز سلوك متكرر)، لا مرة واحدة — بلا حالة إضافية.
    const rState = String((t as any)?.settings?.renewal_state ?? "active");
    const discountPct = (!yearly && (rState === "active" || rState === "due_soon")) ? 5 : 0;
    const baseAmount = yearly ? prices.yearly : prices.monthly;
    const amount = Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100;
    const merchantOrderId = `manara-${tid.slice(0, 8)}-${Date.now().toString(36)}`;
    const { data: inv, error } = await admin.from("platform_payments").insert({
      tenant_id: tid, plan, months, amount, currency: "EGP", status: "pending",
      discount_pct: discountPct > 0 ? discountPct : null,
    }).select("id").single();
    if (error) throw error;
    const { iframeUrl, orderId } = await createIntention({
      amountEgp: amount,
      merchantOrderId: `${merchantOrderId}:${(inv as any).id}`,
      customerName: String((t as any)?.name ?? "Teacher"),
      customerPhone: String((t as any)?.settings?.owner_phone ?? ""),
      method: body.method === "wallet" ? "wallet" : "card",
    });
    await admin.from("platform_payments").update({ paymob_order_id: String(orderId) }).eq("id", (inv as any).id);
    return NextResponse.json({ ok: true, iframe_url: iframeUrl, amount, base_amount: baseAmount, discount_pct: discountPct });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json({ ok: false, error: "not_ready", message: "نفّذ ترحيل 006 من لوحة Supabase أولاً." }, { status: 400 });
    }
    return dbFail("billing-pay", e, "pay_failed");
  }
}
