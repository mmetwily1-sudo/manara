// اختبار حمل P0: قراءة + كتابة آمنة على المسارات الساخنة — p50/p95/أخطاء + عتبات نجاح.
// الاستخدام:
//   node scripts/load-test.cjs            → وضع القراءة فقط (آمن دائماً)
//   LOADTEST_WRITE=1 LOADTEST_HMAC_SECRET=<same-as-preview-PAYMOB_HMAC_SECRET> node scripts/load-test.cjs
//                                         → يضيف مسارات الكتابة الآمنة (لا تغيّر أي حالة)
// مصدر الحقيقة لخوارزمية HMAC: src/lib/paymob.ts (HMAC_FIELDS + val + sha512-hex).
// أي تغيير هناك يجب عكسه هنا — وإلا فشل اختبار الـcallback سيكشف الانحراف فوراً.
//
// تصميم fail-closed (لا أخضر كاذب):
// - وضع الكتابة بدون LOADTEST_HMAC_SECRET → خروج 2 برسالة صريحة (يفشل الـCI ب visibly).
// - أي تجاوز للعتبات → خروج 1. النجاح الكامل فقط → خروج 0.
// - replay الـcallback يستخدم merchant_order_id لفاتورة غير موجودة → المسار الآمن 404
//   (يمارس: parse + تحقق HMAC + استعلام DB واحد) — صفر كتابة مضمون بالكود نفسه.
// - burst التسجيل ببيانات ناقصة عمداً → 400/429 (يمارس rate-limit + validation) — لا حسابات تُنشأ.
// - بدء/تسليم الامتحان والحضور QR خارج النطاق عمداً (يحتاجان جلسة طالب/مفتاح دوّار) — مرحلة 2 بفيكستشر.
const crypto = require("crypto");
const fs = require("fs");

const BASE = process.env.LOADTEST_BASE || "http://localhost:3000";
const WRITE = process.env.LOADTEST_WRITE === "1";
const HMAC_SECRET = process.env.LOADTEST_HMAC_SECRET || "";
const P95_MAX_MS = Number(process.env.LOADTEST_P95_MAX || 2000);
const MAX_ERR_RATE = Number(process.env.LOADTEST_MAX_ERR || 0);

const READ_ROUTES = ["/api/health", "/login", "/join", "/parent", "/progress", "/api/push/public-key"];

// نسخة طبق الأصل من src/lib/paymob.ts — لا تعدل المنطق هنا، عدّله هناك أولاً.
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id",
  "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order.id", "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];
function hval(obj, path) {
  const v = path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
  return String(v ?? "");
}
function signCallback(obj) {
  const concatenated = HMAC_FIELDS.map((f) => hval(obj, f)).join("");
  return crypto.createHmac("sha512", HMAC_SECRET).update(concatenated).digest("hex");
}
// فاتورة مستحيلة الوجود → مسار 404 الآمن (لا كتابة ممكنة فيزيائياً قبل الـlookup).
function fakeCallbackObj() {
  return {
    amount_cents: 45000, created_at: new Date().toISOString(), currency: "EGP",
    error_occured: false, has_parent_transaction: false, id: 999999999,
    integration_id: 111111, is_3d_secure: true, is_auth: true, is_capture: true,
    is_refunded: false, is_standalone_payment: true, is_voided: false,
    order: { id: 888888888, merchant_order_id: "00000000-0000-0000-0000-000000000000" },
    owner: 777777, pending: false,
    source_data: { pan: "2346", sub_type: "Mastercard", type: "card" },
    success: true,
  };
}

const results = [];
let failed = false;

async function hit(method, path, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, { method, ...opts });
    await res.text();
    const ms = Date.now() - t0;
    const ok = (opts.expect || [200]).includes(res.status);
    results.push({ path, status: res.status, ms, ok });
    if (!ok) failed = true;
    return res.status;
  } catch (e) {
    results.push({ path, status: -1, ms: Date.now() - t0, ok: false, err: String(e.message || e).slice(0, 80) });
    failed = true;
    return -1;
  }
}

async function burst(jobs) {
  await Promise.all(jobs.map((fn) => fn()));
}

async function readPhase() {
  console.log("== READ phase ==");
  for (const n of [20, 50, 100, 200]) {
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const r = READ_ROUTES[i % READ_ROUTES.length];
      jobs.push(() => hit("GET", r, { expect: [200] }));
    }
    await burst(jobs);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function writePhase() {
  if (!WRITE) {
    console.log("== WRITE phase: SKIPPED (LOADTEST_WRITE!=1) ==");
    return;
  }
  if (!HMAC_SECRET) {
    console.error("== WRITE phase: REFUSED — LOADTEST_WRITE=1 but LOADTEST_HMAC_SECRET is empty (fail-closed, exit 2) ==");
    process.exit(2);
  }
  console.log("== WRITE phase ==");
  // 1) replay صحيح التوقيع لفاتورة معدومة → 404 متوقع (يمارس HMAC + DB lookup)
  const obj = fakeCallbackObj();
  const good = signCallback(obj);
  const w1 = [];
  for (let i = 0; i < 50; i++) {
    w1.push(() => hit("POST", "/api/billing/callback", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obj, hmac: good }),
      expect: [404],
    }));
  }
  await burst(w1);
  // 2) توقيع فاسد → 403 (يمارس مسار الرفض)
  const w2 = [];
  for (let i = 0; i < 20; i++) {
    w2.push(() => hit("POST", "/api/billing/callback", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obj, hmac: "deadbeef" }),
      expect: [403],
    }));
  }
  await burst(w2);
  // 3) تسجيل ناقص عمداً → 400/429 (يمارس rate-limit + validation، لا كتابة)
  const w3 = [];
  for (let i = 0; i < 15; i++) {
    w3.push(() => hit("POST", "/api/students/register", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "__loadtest__" }),
      expect: [400, 429],
    }));
  }
  await burst(w3);
}

(async () => {
  // إحماء غير محسوب: يمتص cold-start السيرفر/الاتصالات حتى لا تلوث القياس.
  console.log("== WARMUP (unmeasured) ==");
  const warm = [];
  for (let i = 0; i < 30; i++) {
    const r = READ_ROUTES[i % READ_ROUTES.length];
    warm.push(fetch(BASE + r).then((res) => res.text()).catch(() => {}));
  }
  await Promise.all(warm);
  results.length = 0;
  await readPhase();
  await writePhase();
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : 0);
  const p50 = q(0.5), p95 = q(0.95), max = q(1);
  const bad = results.filter((r) => !r.ok);
  const errRate = results.length ? bad.length / results.length : 1;
  const summary = {
    base: BASE, write: WRITE, n: results.length,
    p50_ms: p50, p95_ms: p95, max_ms: max,
    errors: bad.length, err_rate: Number(errRate.toFixed(4)),
    thresholds: { p95_max_ms: P95_MAX_MS, max_err_rate: MAX_ERR_RATE },
  };
  console.log("SUMMARY:" + JSON.stringify(summary));
  try { fs.writeFileSync("load-test-results.json", JSON.stringify({ summary, failures: bad.slice(0, 20) }, null, 2)); } catch {}
  if (failed) { console.error(`GATE: FAIL — ${bad.length} unexpected responses`); process.exit(1); }
  if (p95 > P95_MAX_MS) { console.error(`GATE: FAIL — p95 ${p95}ms > ${P95_MAX_MS}ms`); process.exit(1); }
  if (errRate > MAX_ERR_RATE) { console.error(`GATE: FAIL — err_rate ${errRate} > ${MAX_ERR_RATE}`); process.exit(1); }
  console.log("GATE: PASS");
})().catch((e) => { console.log("FATAL:" + (e.message || e)); process.exit(1); });
