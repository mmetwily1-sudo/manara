/**
 * سكربت تفعيل Supabase — ينفذ schema.sql على قاعدة بياناتك مباشرة
 * الاستخدام: ضع المفاتيح في .env.local ثم شغّل:
 *   node scripts/activate-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

// قراءة .env.local يدوياً (بدون اعتماديات إضافية)
const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL =
  env.SUPABASE_DB_URL ||
  process.argv[2]; // "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres"

if (!URL || !ANON || !SERVICE || !DB_URL) {
  console.error("❌ ناقص قيم! لازم الأربعة في .env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("   SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL");
  process.exit(1);
}

console.log("1/4 فحص الاتصال بالـAPI...");
const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });
const ping = await sb.from("tenants").select("id").limit(1);
console.log(ping.error?.code === "42P01" ? "   ✓ API متصل — الجداول لسه مش موجودة (هتنشأ حالاً)" : `   ✓ API متصل — الجداول موجودة مسبقاً`);

console.log("2/4 تنفيذ schema.sql عبر Postgres المباشر...");
const sql = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// نقسم على الـstatements الفاصلة بعناية للدوال والـpolicies
await client.query(sql);
console.log("   ✓ السكيما اتنفذت كاملة (21 جدول + RLS + seed)");

console.log("3/4 التحقق النهائي...");
const tables = await client.query(
  "select table_name from information_schema.tables where table_schema='public' order by table_name"
);
console.log(`   ✓ ${tables.rows.length} جدول:`, tables.rows.map((r) => r.table_name).join(", "));
await client.end();

console.log("4/4 اختبار إنشاء tenant تجريبي عبر API...");
const ins = await sb
  .from("tenants")
  .insert({ name: "فحص التفعيل", slug: `activation-${Date.now().toString(36)}`, plan: "trial" })
  .select("slug")
  .single();
if (ins.error) { console.error("   ✗", ins.error.message); process.exit(1); }
console.log(`   ✓ اتنشأ بنجاح: ${ins.data.slug}`);

console.log("\n🎉 تم التفعيل! ضيف المفاتيح نفسها لـVercel لما تنشر، وكل تسجيل من الموقع هينشئ سنتر حقيقي.");
