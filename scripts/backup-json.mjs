// node scripts/backup-json.mjs — نسخة منطقية كاملة (JSON) لكل جداول public.
// يعمل محلياً بمفتاح service_role. للاستعادة: scripts/restore-json.mjs (قيد الإنشاء عند الحاجة).
// التشغيل المقترح: أسبوعياً + قبل أي ترحيل كبير. (PITR الحقيقي يتطلب خطة Pro)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"));
const pg = require("pg");
const envRaw = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local"), "utf8");
const url = envRaw.match(/DATABASE_URL=(.+)/)[1].trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const ts = new Date().toISOString().slice(0, 10);
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "backups", ts);
fs.mkdirSync(dir, { recursive: true });
const tables = (await pool.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map((r) => r.tablename);
const manifest = { at: new Date().toISOString(), tables: {} };
for (const tb of tables) {
  try {
    const r = await pool.query(`select * from public.${JSON.stringify(tb).slice(1, -1).replace(/"/g, "")}`);
    fs.writeFileSync(path.join(dir, tb + ".json"), JSON.stringify(r.rows));
    manifest.tables[tb] = r.rows.length;
  } catch (e) { manifest.tables[tb] = "ERR:" + e.message.slice(0, 80); }
}
fs.writeFileSync(path.join(dir, "_manifest.json"), JSON.stringify(manifest, null, 1));
const total = Object.values(manifest.tables).reduce((s, n) => s + (typeof n === "number" ? n : 0), 0);
console.log("BACKUP-OK dir=backups/" + ts + " tables=" + tables.length + " rows=" + total);
// مرآة خارج الجهاز (OneDrive) — توصية اللجنة ضد عطل الجهاز
try {
  const mirror = "C:\\Users\\LORD LAPTOP\\OneDrive\\manara-backups\\" + ts;
  fs.mkdirSync(mirror, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(mirror, f));
  console.log("MIRROR-OK " + mirror);
} catch (e) { console.log("MIRROR-SKIP " + e.message.slice(0, 80)); }
await pool.end();
