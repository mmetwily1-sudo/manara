import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCallbackHmac } from "@/lib/paymob";

/**
 * POST /api/billing/callback — إشعار Paymob بعد الدفع (عام، مؤمّن بـ HMAC).
 * success=true → paid + تفعيل الخطة للسنتر (paid_until في settings).
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const body = await req.json().catch(() => null as any);
  const obj = body?.obj;
  const hmac = String(req.headers.get("x-hmac") ?? body?.hmac ?? "");
  // Paymob يرسل HMAC في الـ query غالباً — اقبله من أي مصدر
  const urlHmac = new URL(req.url).searchParams.get("hmac") ?? "";
  if (!obj || !verifyCallbackHmac(obj, hmac || urlHmac)) {
    return NextResponse.json({ ok: false, error: "bad_hmac" }, { status: 403 });
  }

  const merchantOrder: string = String(obj.order?.merchant_order_id ?? obj.merchant_order_id ?? "");
  const invId = merchantOrder.split(":").pop() ?? "";
  const success = obj.success === true || obj.success === "true";
  try {
    const { data: inv } = await admin.from("platform_payments").select("id,tenant_id,plan,months,status").eq("id", invId).single();
    if (!inv) return NextResponse.json({ ok: false, error: "unknown_invoice" }, { status: 404 });
    if ((inv as any).status === "paid") return NextResponse.json({ ok: true, duplicate: true });
    await admin.from("platform_payments").update({
      status: success ? "paid" : "failed",
      txn_id: String(obj.id ?? ""),
    }).eq("id", invId);
    if (success) {
      const { data: t } = await admin.from("tenants").select("settings").eq("id", (inv as any).tenant_id).single();
      const paidUntil = new Date(Date.now() + Number((inv as any).months || 1) * 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("tenants").update({
        plan: (inv as any).plan,
        settings: { ...(((t as any)?.settings ?? {}) as object), plan_paid_until: paidUntil },
      }).eq("id", (inv as any).tenant_id);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
