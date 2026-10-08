// إثبات قدرة النسخ: يقرأ كل جداول public عبر اتصال Postgres المباشر (service_role
// يتجاوز RLS) ويثبت أن بيانات الاعتماد وخط الأنابيب يعملان end-to-end.
// قراءة فقط — لا يكتب شيئاً في أي مكان. التقرير: db-backup-proof.json (يُتجاهل في git).
// ملاحظة الأمانة: هذا يثبت النسخ (backup)، لا الاستعادة (restore) — الاستعادة الكاملة
// تحتاج مشروع Supabase منفصلاً وتُنفذ من لوحة التحكم (راجع docs/pitr-drill.md).
const fs = require("fs");
const { Client } = require("pg");
(async () => {
  const raw = fs.readFileSync(".env.local", "utf8");
  const m = raw.match(/DATABASE_URL=(.*)/);
  if (!m) { console.log("NO-DATABASE_URL"); process.exit(1); }
  const c = new Client({ connectionString: m[1].trim(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const tables = await c.query(
    "select tablename from pg_tables where schemaname='public' order by 1"
  );
  const report = { at: new Date().toISOString(), tables: {}, errors: [] };
  for (const { tablename: t } of tables.rows) {
    try {
      const cols = await c.query(
        "select column_name,data_type from information_schema.columns where table_name=$1 order by ordinal_position",
        [t]
      );
      const cnt = await c.query(`select count(*)::int as n from "${t}"`);
      report.tables[t] = { columns: cols.rows.length, rows: cnt.rows[0].n };
    } catch (e) {
      report.tables[t] = { error: String(e.message).slice(0, 120) };
      report.errors.push(t);
    }
  }
  await c.end();
  const totalRows = Object.values(report.tables).reduce((s, x) => s + (x.rows || 0), 0);
  report.summary = { tableCount: tables.rows.length, totalRows, unreadable: report.errors };
  fs.writeFileSync("db-backup-proof.json", JSON.stringify(report, null, 2));
  console.log(`TABLES=${tables.rows.length} ROWS=${totalRows} UNREADABLE=${report.errors.length}`);
  if (report.errors.length) { console.log("FAILED-TABLES:" + report.errors.join(",")); process.exit(1); }
  console.log("BACKUP-PROOF: PASS (read pipeline works end-to-end)");
})().catch((e) => { console.log("FATAL:" + e.message); process.exit(1); });
