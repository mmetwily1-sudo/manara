// node scripts/smoke.mjs — دخان كل مسارات API: مالك (لا 401/403/500) + مجهول (لا 200-ok ولا 500).
// ينشئ سنتر اختبار وينظفه. خروج 1 عند أي تسريب/انهيار.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"));
const { createClient } = require("@supabase/supabase-js");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const envRaw = fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8");
const SB_URL = envRaw.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const SB_KEY = envRaw.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const SB_ANON = envRaw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const anon = createClient(SB_URL, SB_ANON);

// اكتشاف المسارات من الملفات
const apiDir = path.join(HERE, "..", "src", "app", "api");
const routes = [];
(function walk(d, prefix) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(d, e.name), prefix + "/" + e.name);
    else if (e.name === "route.ts") routes.push(prefix || "/");
  }
})(apiDir, "/api");
const FAKE = "00000000-0000-0000-0000-000000000000";
const withId = (p) => p.replace(/\[id\]/g, FAKE).replace(/\[orderId\]/g, FAKE).replace(/\[code\]/g, "x").replace(/\[studentId\]/g, FAKE);

const tag = Date.now().toString(36);
const em = "smoke" + tag + "@example.com";
const { data: au } = await admin.auth.admin.createUser({ email: em, password: "Test123456", email_confirm: true });
const { data: t } = await admin.from("tenants").insert({ name: "سنتر دخان", slug: "smoke" + tag, plan: "trial", status: "active" }).select("id").single();
await admin.from("users").insert({ tenant_id: t.id, auth_user_id: au.user.id, role: "teacher_admin", full_name: "معلم", phone: "021" + String(Date.now()).slice(-8) });
const { data: s } = await anon.auth.signInWithPassword({ email: em, password: "Test123456" });
const ss = s.session;
const full = { access_token: ss.access_token, refresh_token: ss.refresh_token, expires_in: ss.expires_in, expires_at: ss.expires_at, token_type: ss.token_type, user: ss.user };
const b64 = Buffer.from(JSON.stringify(full)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ref = new URL(SB_URL).hostname.split(".")[0];
const H = { Cookie: "sb-" + ref + "-auth-token=base64-" + b64, "Content-Type": "application/json" };
const N = { "Content-Type": "application/json" };

const call = async (m, p, h, b) => {
  try {
    const r = await fetch(BASE + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch {}
    return { s: r.status, ok: j?.ok === true, err: j?.error ?? t.slice(0, 60) };
  } catch (e) { return { s: -1, ok: false, err: "conn:" + e.message.slice(0, 50) }; }
};

const OWNER_GATED = ["/api/admin/", "/api/digests/run", "/api/referrals/settle"]; // 403 متوقع للمالك (منصة/cron)
const PUBLIC_OK = ["/api/public/stats", "/api/push/public-key", "/api/health"]; // 200 للعامة بالتصميم
const isDyn = (r) => r.includes("[");
let pass = 0, fail = 0;
const bad = [];
for (const route of routes.sort()) {
  const p = withId(route);
  // GET
  const g = await call("GET", p, H);
  const gn = await call("GET", p, N);
  const gated = OWNER_GATED.some((x) => route.startsWith(x));
  const pub = PUBLIC_OK.includes(route);
  const gOwnerBad = !gated && !isDyn(route) && (g.s === 401 || g.s === 403 || g.s === 500 || g.s === -1);
  const gOwnerDynBad = !gated && isDyn(route) && (g.s === 500 || g.s === -1 || g.s === 401);
  const gAnonBad = !pub && ((gn.s === 200 && gn.ok) || gn.s === 500);
  // POST فارغ (يُتوقع 400/401/403/404/405 لا 500)
  const po = await call("POST", p, H, {});
  const pn = await call("POST", p, N, {});
  const pBad = [po, pn].some((x) => x.s === 500);
  const dynBad = gOwnerDynBad;
  if (!gOwnerBad && !dynBad && !gAnonBad && !pBad) { pass++; continue; }
  fail++;
  bad.push(`${route} ownerGET=${g.s}${gOwnerBad || dynBad ? "!" : ""} anonGET=${gn.s}${gAnonBad ? "!" : ""} post500=${pBad}`);
}
console.log(`SMOKE: ${routes.length} routes, pass=${pass} fail=${fail}`);
bad.forEach((b) => console.log("  FAIL " + b));
// cleanup
await admin.from("users").delete().eq("tenant_id", t.id);
await admin.from("tenants").delete().eq("id", t.id);
await admin.auth.admin.deleteUser(au.user.id);
console.log("cleaned");
process.exit(fail ? 1 : 0);
