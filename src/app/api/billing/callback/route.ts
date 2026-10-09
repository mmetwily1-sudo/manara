import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyCallbackHmac } from "@/lib/paymob";
import { dbFail } from "@/lib/api-error";

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
  const success = obj.success === true || obj.success === "true";
  // فواتير أولياء الأمور: parent-{tid8}-{ts}:{invoiceId} → تحديث المدفوع والحالة
  if (merchantOrder.startsWith("parent-")) {
    const invId = merchantOrder.split(":").pop() ?? "";
    if (!invId) return NextResponse.json({ ok: false, error: "bad_order" }, { status: 400 });
    try {
      const { data: inv } = await admin.from("invoices").select("id,tenant_id,student_id,amount,paid,status").eq("id", invId).single();
      if (!inv) return NextResponse.json({ ok: false, error: "unknown_invoice" }, { status: 404 });
      if ((inv as any).status === "paid") return NextResponse.json({ ok: true, duplicate: true });
      if (!success) return NextResponse.json({ ok: true, failed: true });
      const got = Math.max(0, Math.round(Number(obj.amount_cents ?? 0) / 100));
      const total = Number((inv as any).amount ?? 0);
      const paid = Math.min(total, Number((inv as any).paid ?? 0) + got);
      const { error } = await admin.from("invoices").update({
        paid, status: paid >= total ? "paid" : "partial", paid_at: new Date().toISOString(),
      }).eq("id", invId);
      if (error) return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
      // إيصال فوري لولي الأمر: إعادة استخدام notifyStudent (يدعم العربية + dedupe + كل القنوات)
      try {
        const { notifyStudent } = await import("@/lib/notify");
        const [{ data: tt }, { data: st }] = await Promise.all([
          admin.from("tenants").select("name").eq("id", (inv as any).tenant_id).single(),
          admin.from("users").select("full_name").eq("id", (inv as any).student_id).single(),
        ]);
        await notifyStudent(admin, {
          tenantId: (inv as any).tenant_id, studentId: (inv as any).student_id,
          event: {
            kind: "payment_received", studentName: String((st as any)?.full_name ?? ""),
            amount: got, centerName: String((tt as any)?.name ?? ""),
          },
          dedupeKey: `invoice:${invId}:${String(obj.id ?? "na")}`,
        });
      } catch {}
      return NextResponse.json({ ok: true, paid });
    } catch {
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
  }
  const invId = merchantOrder.split(":").pop() ?? "";
  try {
    const { data: inv } = await admin.from("platform_payments").select("id,tenant_id,plan,months,status").eq("id", invId).single();
    if (!inv) return NextResponse.json({ ok: false, error: "unknown_invoice" }, { status: 404 });
    if ((inv as any).status === "paid") return NextResponse.json({ ok: true, duplicate: true });
    await admin.from("platform_payments").update({
      status: success ? "paid" : "failed",
      txn_id: String(obj.id ?? ""),
    }).eq("id", invId);
    if (success) {
      // الإحالة: أول فاتورة مدفوعة للمُحال → qualified (المكافأة بعد فترة الحماية عبر settle)
      try {
        const { count: priorPaid } = await admin.from("platform_payments").select("id", { count: "exact", head: true })
          .eq("tenant_id", (inv as any).tenant_id).eq("status", "paid").neq("id", invId);
        if (!priorPaid) {
          await admin.from("referrals").update({ status: "qualified", qualified_at: new Date().toISOString() })
            .eq("referee_tenant_id", (inv as any).tenant_id).eq("status", "pending");
        }
      } catch {}
      const { data: t } = await admin.from("tenants").select("settings").eq("id", (inv as any).tenant_id).single();
      const paidUntil = new Date(Date.now() + Number((inv as any).months || 1) * 30 * 24 * 60 * 60 * 1000).toISOString();
      // كتابة ذرية واحدة: الخطة + plan_paid_until + إعادة تفعيل التجديد معاً (088) —
      // لا قراءة-ثم-دمج هنا، فلا سباق مع كرون التجديد (نفس نمط lib/renewals).
      const prevRenewal = String((t as any)?.settings?.renewal_state ?? "active");
      const { error: werr } = await admin.rpc("tenant_patch_settings", {
        p_tenant_id: (inv as any).tenant_id,
        p_plan: (inv as any).plan,
        p_patch: { plan_paid_until: paidUntil, renewal_state: "active", grace_until: null, renewal_reminder_sent_at: null },
      });
      if (werr) return dbFail("callback-activate", werr);
      if (prevRenewal !== "active") {
        try {
          const { logRenewalEvent } = await import("@/lib/renewals");
          await logRenewalEvent(admin, (inv as any).tenant_id, prevRenewal, "active", "payment");
        } catch {}
      }
      // إيصال فوري للمالك: الخطة + المبلغ المحصّل فعلاً + تاريخ الانتهاء الجديد
      // (يذكر الخصم فقط لو مسجل على الفاتورة — الصدق أولاً).
      try {
        const { notifyOwner } = await import("@/lib/notify");
        const gotPlat = Math.max(0, Math.round(Number(obj.amount_cents ?? 0) / 100));
        const [{ data: pp }, { data: tt2 }] = await Promise.all([
          admin.from("platform_payments").select("discount_pct").eq("id", invId).single(),
          admin.from("tenants").select("name").eq("id", (inv as any).tenant_id).single(),
        ]);
        const disc = Number((pp as any)?.discount_pct ?? 0) > 0 ? " (شامل خصم التجديد المبكر 5%)" : "";
        const until = new Date(paidUntil).toLocaleDateString("ar-EG");
        await notifyOwner(admin, {
          tenantId: (inv as any).tenant_id,
          body: `تم استلام اشتراك ${String((tt2 as any)?.name ?? "")} (${(inv as any).plan}) بمبلغ ${gotPlat} جنيه${disc} — مفعّل حتى ${until}. شكراً لثقتكم بمنارة ✅`,
          event: "platform_payment_received",
          dedupeKey: `platform-pay:${invId}:${String(obj.id ?? "na")}`,
        });
      } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
