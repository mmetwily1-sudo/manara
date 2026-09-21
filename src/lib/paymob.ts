import { createHmac } from "crypto";

/**
 * Paymob Intention API (v1) — تحصيل اشتراكات المنصة (بطاقات/محافظ) أونلاين.
 * البيئة المطلوبة (Vercel): PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY,
 * PAYMOB_CARD_INTEGRATION_ID, PAYMOB_HMAC_SECRET (+ PAYMOB_WALLET_INTEGRATION_ID اختياري).
 * بدونها: isPaymobLive()=false وتبقى الطرق اليدوية.
 */

const BASE = "https://accept.paymob.com";

export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 450, yearly: 4500 },
  pro: { monthly: 750, yearly: 7500 },
  scale: { monthly: 1500, yearly: 15000 },
};

export function isPaymobLive(): boolean {
  return !!(
    process.env.PAYMOB_SECRET_KEY &&
    process.env.PAYMOB_PUBLIC_KEY &&
    process.env.PAYMOB_CARD_INTEGRATION_ID &&
    process.env.PAYMOB_HMAC_SECRET
  );
}

/** ينشئ نية دفع ويرجع رابط الدفع الموحد (يُفتح في تبويب جديد) */
export async function createIntention(opts: {
  amountEgp: number; merchantOrderId: string; customerName: string; customerPhone?: string; customerEmail?: string; method?: "card" | "wallet";
}): Promise<{ iframeUrl: string; orderId: number }> {
  const secret = process.env.PAYMOB_SECRET_KEY!;
  const integrationId = opts.method === "wallet"
    ? (process.env.PAYMOB_WALLET_INTEGRATION_ID || process.env.PAYMOB_CARD_INTEGRATION_ID!)
    : process.env.PAYMOB_CARD_INTEGRATION_ID!;
  const cents = Math.round(opts.amountEgp * 100);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(BASE + "/v1/intention/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Token " + secret },
      signal: ctrl.signal,
      body: JSON.stringify({
        amount: cents,
        currency: "EGP",
        payment_methods: [Number(integrationId)],
        items: [{ name: "Manara subscription", amount: cents, description: opts.merchantOrderId.slice(0, 100), quantity: 1 }],
        billing_data: {
          apartment: "NA", first_name: opts.customerName.slice(0, 30) || "Teacher", last_name: "Manara",
          street: "NA", building: "NA", phone_number: (opts.customerPhone || "+201000000000").slice(0, 15),
          city: "Cairo", country: "EG", email: opts.customerEmail || "noreply@manara.app",
          floor: "NA", state: "Cairo",
        },
        customer: { first_name: opts.customerName.slice(0, 30) || "Teacher", last_name: "Manara", email: opts.customerEmail || "noreply@manara.app" },
        extras: { merchant_order_id: opts.merchantOrderId },
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !(j as any)?.client_secret) throw new Error("paymob_" + r.status);
    return {
      iframeUrl: `${BASE}/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${(j as any).client_secret}`,
      orderId: Number((j as any).intention_order_id ?? (j as any).id ?? 0),
    };
  } finally {
    clearTimeout(timer);
  }
}

const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
  "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];

function val(obj: any, path: string): string {
  const v = path.split(".").reduce((o, k) => (o as any)?.[k], obj);
  return String(v ?? "");
}

/** تحقق HMAC-SHA512 لرد Paymob — يمنع تزوير إشعارات الدفع */
export function verifyCallbackHmac(obj: any, hmac: string): boolean {
  const secret = process.env.PAYMOB_HMAC_SECRET ?? "";
  if (!secret || !hmac) return false;
  const concatenated = HMAC_FIELDS.map((f) => val(obj, f)).join("");
  const digest = createHmac("sha512", secret).update(concatenated).digest("hex");
  if (digest.length !== hmac.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ hmac.charCodeAt(i);
  return diff === 0;
}
