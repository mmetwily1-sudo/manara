// node scripts/load.mjs — حمل محلي: 6 مسارات ساخنة × 100 طلب بتزامن 10. p50/p95/max + أخطاء.
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
const N = 100, C = 10;

const tag = Date.now().toString(36);
const emT = "ldT" + tag + "@example.com";
const { data: auT } = await admin.auth.admin.createUser({ email: emT, password: "Test123456", email_confirm: true });
const { data: t } = await admin.from("tenants").insert({ name: "سنتر حمل", slug: "load" + tag, plan: "trial", status: "active" }).select("id").single();
await admin.from("users").insert({ tenant_id: t.id, auth_user_id: auT.user.id, role: "teacher_admin", full_name: "معلم", phone: "022" + String(Date.now()).slice(-8) });
const emS = "ldS" + tag + "@example.com";
const { data: auS } = await admin.auth.admin.createUser({ email: emS, password: "Test123456", email_confirm: true });
const { data: stu } = await admin.from("users").insert({ tenant_id: t.id, auth_user_id: auS.user.id, role: "student", full_name: "طالب", phone: "023" + String(Date.now()).slice(-8) }).select("id").single();
const qids = [];
for (let i = 0; i < 3; i++) {
  const { data: q } = await admin.from("questions").insert({ tenant_id: t.id, body: "س" + i, options: ["أ", "ب"], correct_answer: "أ", qtype: "mcq", marks: 1, status: "approved" }).select("id").single();
  qids.push(q.id);
}
const { data: ex } = await admin.from("exams").insert({ tenant_id: t.id, title: "حمل", duration_minutes: 30, is_published: true, require_code: false }).select("id").single();
for (let i = 0; i < qids.length; i++) await admin.from("exam_questions").insert({ tenant_id: t.id, exam_id: ex.id, question_id: qids[i], position: i + 1, marks: 1 });
const { data: grp } = await admin.from("groups").insert({ tenant_id: t.id, name: "ج" }).select("id").single();
const J = async (email, pw) => {
  const { data: s } = await anon.auth.signInWithPassword({ email, password: pw });
  const ss = s.session;
  const full = { access_token: ss.access_token, refresh_token: ss.refresh_token, expires_in: ss.expires_in, expires_at: ss.expires_at, token_type: ss.token_type, user: ss.user };
  const b64 = Buffer.from(JSON.stringify(full)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const ref = new URL(SB_URL).hostname.split(".")[0];
  return { Cookie: "sb-" + ref + "-auth-token=base64-" + b64, "Content-Type": "application/json" };
};
const HT = await J(emT, "Test123456");
const HS = await J(emS, "Test123456");
// جلسة امتحان جاهزة
const { data: coderow } = await admin.from("exam_codes").insert({ tenant_id: t.id, exam_id: ex.id, student_id: stu.id, code_hash: "x", code_hint: "x", status: "started", started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 18e5).toISOString() }).select("id").single();
const { data: sess } = await admin.from("sessions").insert({ tenant_id: t.id, group_id: grp.id, session_date: new Date().toISOString().slice(0, 10), status: "scheduled" }).select("id").single();
const answers = Object.fromEntries(qids.map((id) => [id, "أ"]));

const jobs = [
  ["GET exams-list", "GET", "/api/exams", HT, null, [200]],
  ["GET exam-student", "GET", "/api/exams/" + ex.id, HS, null, [200]],
  ["POST submit", "POST", "/api/exams/" + ex.id + "/submit", HS, { answers }, [200]],
  ["POST attendance", "POST", "/api/attendance", HT, { sessionId: sess.id, studentId: stu.id, status: "present" }, [200]],
  ["GET payments", "GET", "/api/payments", HT, null, [200]],
  ["POST claim-badcode", "POST", "/api/exams/" + ex.id + "/claim", HS, { code: "ZZZZZZ" }, [404, 429]],
];
for (const [name, m, p, h, b] of jobs.map((j) => j)) {
  const times = [];
  let bad = 0;
  const one = async () => {
    const t0 = Date.now();
    try {
      const r = await fetch(BASE + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
      await r.text();
      times.push(Date.now() - t0);
      return r.status;
    } catch { times.push(Date.now() - t0); return -1; }
  };
  const workers = Array.from({ length: C }, async () => {
    const per = Math.floor(N / C);
    for (let i = 0; i < per; i++) {
      const s = await one();
      const exp = jobs.find((j) => j[0] === name)[5];
      if (!exp.includes(s)) bad++;
    }
  });
  await Promise.all(workers);
  times.sort((a, b2) => a - b2);
  const pct = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  console.log(`${name}: n=${times.length} p50=${pct(0.5)}ms p95=${pct(0.95)}ms max=${times[times.length - 1]}ms unexpected=${bad}`);
}
// cleanup
await admin.from("exam_attempts").delete().eq("exam_id", ex.id);
await admin.from("exam_codes").delete().eq("exam_id", ex.id);
await admin.from("exam_questions").delete().eq("exam_id", ex.id);
await admin.from("exams").delete().eq("id", ex.id);
await admin.from("questions").delete().eq("tenant_id", t.id);
await admin.from("attendance").delete().eq("tenant_id", t.id);
await admin.from("sessions").delete().eq("tenant_id", t.id);
await admin.from("groups").delete().eq("tenant_id", t.id);
await admin.from("audit_log").delete().eq("tenant_id", t.id);
await admin.from("users").delete().eq("tenant_id", t.id);
await admin.from("tenants").delete().eq("id", t.id);
for (const u of [auT, auS]) await admin.auth.admin.deleteUser(u.user.id);
console.log("cleaned");
process.exit(0);
