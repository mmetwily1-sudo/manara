/**
 * Supabase OAuth (PKCE + Dynamic Client Registration) → Management API token
 * ثم تنفيذ schema.sql عن بُعد عبر /database/query
 *
 * الاستخدام: node scripts/sb-oauth.mjs
 * هيتطلب موافقة واحدة في المتصفح.
 */
import http from "node:http";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const PROJECT_REF = "tshpfgdcpdaouznxpcne";
const API = "https://api.supabase.com";
const REDIRECT_PORT = 9899;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;

const b64url = (b) => Buffer.from(b).toString("base64url");
const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
const state = b64url(crypto.randomBytes(16));

function log(m) { console.log(m); }

// 1) تسجيل عميل OAuth ديناميكياً
log("1/5 تسجيل عميل OAuth...");
const regRes = await fetch(`${API}/v1/oauth/clients`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "manara-cli",
    redirect_uris: [REDIRECT_URI],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "projects.read database.read database.write",
  }),
});
const reg = await regRes.json().catch(() => ({}));
if (!regRes.ok || !reg.client_id) {
  console.error(`فشل التسجيل (${regRes.status}):`, JSON.stringify(reg).slice(0, 400));
  process.exit(1);
}
log(`   ✓ client_id: ${reg.client_id.slice(0, 12)}...`);

// 2) فتح صفحة الموافقة + التقاط الكود
const authUrl =
  `${API}/v1/oauth/authorize?response_type=code&client_id=${reg.client_id}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent("projects.read database.read database.write")}` +
  `&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

const codePromise = new Promise((resolve, reject) => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, REDIRECT_URI);
    if (u.pathname !== "/callback") { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>✅ تم التفويض — ارجع للتيرمنال، شغلنا كمّل أوتوماتيك</h2><script>setTimeout(()=>window.close(),1500)</script>");
    srv.close();
    if (u.searchParams.get("state") !== state) return reject(new Error("state mismatch"));
    resolve(u.searchParams.get("code"));
  });
  srv.listen(REDIRECT_PORT, "127.0.0.1");
});

log("2/5 فتح صفحة الموافقة في متصفحك...");
console.log("\n──────────────────────────────────────────");
console.log("لو الصفحة مفتحتش، افتح الرابط ده يدوياً:");
console.log(authUrl);
console.log("──────────────────────────────────────────\n");
import("node:child_process").then(({ exec }) => exec(`start "" "${authUrl}"`));

const timeout = setTimeout(() => { console.error("⏰ انتهى وقت الموافقة (3 دقايق)"); process.exit(2); }, 180000);
const code = await codePromise;
clearTimeout(timeout);
log("   ✓ التفويض استلم");

// 3) استبدال الكود بـaccess_token
log("3/5 استبدال الكود بالتوكن...");
const tokRes = await fetch(`${API}/v1/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: reg.client_id,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  }),
});
const tok = await tokRes.json().catch(() => ({}));
if (!tokRes.ok || !tok.access_token) {
  console.error(`فشل التوكن (${tokRes.status}):`, JSON.stringify(tok).slice(0, 300));
  process.exit(1);
}
log("   ✓ توكن الإدارة جاهز");

const mgmt = {
  Authorization: `Bearer ${tok.access_token}`,
  "Content-Type": "application/json",
};

// 4) تنفيذ schema.sql عن بُعد
log("4/5 تنفيذ schema.sql على قاعدة المشروع...");
const sql = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const qRes = await fetch(`${API}/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: mgmt,
  body: JSON.stringify({ query: sql }),
});
const qData = await qRes.json().catch(() => ({}));
if (!qRes.ok) {
  console.error(`فشل التنفيذ (${qRes.status}):`, JSON.stringify(qData).slice(0, 500));
  // لو الخطأ بسبب تعدد الـstatements نحاول تقسيم بدائي على ; خارج الدوال
  process.exit(1);
}
log("   ✓ السكيما اتنفذت");

// 5) تحقق نهائي: عدّ الجداول + إنشاء tenant تجريبي
log("5/5 تحقق نهائي...");
const cnt = await fetch(`${API}/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST", headers: mgmt,
  body: JSON.stringify({ query: "select count(*)::int as c from information_schema.tables where table_schema='public'" }),
});
const cntData = await cnt.json();
log(`   ✓ عدد الجداول العامة: ${cntData[0]?.c ?? "?"}`);

process.stdout.write("TOKEN_FOR_ENV=" + tok.access_token + "\n");
log("\n🎉 جاهز! الخطوة الجاية تشغّل activate-supabase.mjs للتحقق النهائي");
