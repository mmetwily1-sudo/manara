import { createHmac } from "crypto";

/**
 * Paymob Accept — تحصيل اشتراكات المنصة (بطاقات/محافظ) أونلاين.
 * البيئة المطلوبة (Vercel): PAYMOB_API_KEY, PAYMOB_HMAC_SECRET,
 * PAYMOB_CARD_INTEGRATION_ID, PAYMOB_IFRAME_ID (+ PAYMOB_WALLET_INTEGRATION_ID اختياري).
 * بدونها: isPaymobLive()=false وتبقى الطرق اليدوية.
 */

const BASE = "https://accept.paymob.com/api";

export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 450, yearly: 4500 },
  pro: { monthly: 750, yearly: 7500 },
  scale: { monthly: 1500, yearly: 15000 },
};

export function isPaymobLive(): boolean {
  return !!(
    process.env.PAYMOB_API_KEY &&
    process.env.PAYMOB_HMAC_SECRET &&
    process.env.PAYMOB_CARD_INTEGRATION_ID &&
    process.env.PAYMOB_IFRAME_ID
  );
}

async function postJson(path: string, body: unknown): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(BASE + path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: ctrl.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error("paymob_" + r.status);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

/** ينشئ نية دفع ويرجع رابط الـ iframe */
export async function createIntention(opts: {
  amountEgp: number; merchantOrderId: string; customerName: string; customerPhone?: string; customerEmail?: string; method?: "card" | "wallet";
}): Promise<{ iframeUrl: string; orderId: number }> {
  const apiKey = process.env.PAYMOB_API_KEY!;
  const integrationId = opts.method === "wallet"
    ? (process.env.PAYMOB_WALLET_INTEGRATION_ID || process.env.PAYMOB_CARD_INTEGRATION_ID!)
    : process.env.PAYMOB_CARD_INTEGRATION_ID!;
  const auth = await postJson("/auth/tokens", { api_key: apiKey });
  const order = await postJson("/ecommerce/orders", {
    auth_token: auth.token,
    delivery_needed: false,
    amount_cents: Math.round(opts.amountEgp * 100),
    currency: "EGP",
    merchant_order_id: opts.merchantOrderId,
    items: [{ name: "Manara subscription", amount_cents: Math.round(opts.amountEgp * 100), description: opts.merchantOrderId, quantity: 1 }],
  });
  const key = await postJson("/acceptance/payment_keys", {
    auth_token: auth.token,
    amount_cents: Math.round(opts.amountEgp * 100),
    expiration: 3600,
    order_id: order.id,
    billing_data: {
      first_name: opts.customerName.slice(0, 30) || "Teacher",
      last_name: "Manara",
      email: opts.customerEmail || "noreply@manara.app",
      phone_number: (opts.customerPhone || "+201000000000").slice(0, 15),
      apartment: "NA", floor: "NA", street: "NA", building: "NA",
      city: "Cairo", country: "EG", state: "Cairo", postal_code: "NA",
    },
    currency: "EGP",
    integration_id: Number(integrationId),
  });
  return {
    iframeUrl: `${BASE}/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${key.token}`,
    orderId: order.id,
  };
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
