/**
 * تشغيل ترحيل واحد على قاعدة البيانات مباشرة عبر SUPABASE_DB_URL
 * الاستخدام: node scripts/migrate.mjs database/migrations/002-video-sources.sql
 */
import { readFileSync } from "node:fs";
import pg from "pg";

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

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/migrate.mjs <sql-file>");
  process.exit(1);
}
if (!env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL missing in .env.local");
  process.exit(1);
}

const sql = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(sql);
console.log(`OK: migration applied (${file})`);
await client.end();
