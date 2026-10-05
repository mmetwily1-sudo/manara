// بوابة العزل: مستأجر أ لا يرى بيانات مستأجر ب أبداً (قرار المجلس — يعمل مع smoke)
const fs = require("fs");
const raw = fs.readFileSync(".env.local", "utf8");
const u = raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const k = raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const sk = raw.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const ref = u.match(/https:\/\/([^.]+)\./)[1];
const { createClient } = require("@supabase/supabase-js");
const B = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? "PASS:" : "FAIL:") + n); c ? pass++ : fail++; };
(async () => {
  const ad = createClient(u, sk, { auth: { persistSession: false } });
  const em = "iso-" + Date.now() + "@t.com";
  const suffix = String(Date.now()).slice(-6);
  const { data: tb } = await ad.from("tenants").insert({ name: "عزل-ب", slug: "iso-b-" + Date.now().toString(36), plan: "trial", status: "active" }).select("id").single();
  const { data: au } = await ad.auth.admin.createUser({ email: em, password: "Test1234", email_confirm: true });
  await ad.from("users").insert({ tenant_id: tb.id, auth_user_id: au.user.id, role: "teacher_admin", full_name: "B", phone: "01000" + suffix });
  // طالب في ب + امتحان منشور في ب + سؤال مربوط
  const { data: stb } = await ad.from("users").insert({ tenant_id: tb.id, role: "student", full_name: "طالب-ب", phone: "01001" + suffix }).select("id").single();
  const { data: exb } = await ad.from("exams").insert({ tenant_id: tb.id, title: "ISO", duration_minutes: 5, total_marks: 1, is_published: true }).select("id").single();
  const { data: qb } = await ad.from("questions").insert({ tenant_id: tb.id, subject: "X", qtype: "mcq", body: "Q?", options: ["a", "b"], correct_answer: "a", difficulty: 1, visibility: "private", status: "approved", marks: 1 }).select("id").single();
  await ad.from("exam_questions").insert({ tenant_id: tb.id, exam_id: exb.id, question_id: qb.id, position: 0, marks: 1 });
  // جلسة معلم من سنتر حقيقي آخر (أول سنتر غير ب)
  const { data: ta } = await ad.from("tenants").select("id").neq("id", tb.id).limit(1).single();
  const ema = "iso-a-" + Date.now() + "@t.com";
  const { data: aua } = await ad.auth.admin.createUser({ email: ema, password: "Test1234", email_confirm: true });
  await ad.from("users").insert({ tenant_id: ta.id, auth_user_id: aua.user.id, role: "teacher_admin", full_name: "A", phone: "01002" + suffix });
  const sb = createClient(u, k, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: ema, password: "Test1234" });
  const sess = (await sb.auth.getSession()).data.session;
  const hdrs = { Cookie: `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify({ access_token: sess.access_token, refresh_token: sess.refresh_token, expires_at: sess.expires_at, user: sess.user }))}` };
  // 1) قائمة طلاب أ لا تحوي طالب ب
  let r = await fetch(B + "/api/students", { headers: hdrs });
  let j = await r.json();
  ok("A-list-excludes-B", r.ok && !(JSON.stringify(j).includes("طالب-ب")));
  // 2) امتحان ب مرفوض لأ
  r = await fetch(B + "/api/exams/" + exb.id, { headers: hdrs });
  ok("A-exam-B-forbidden", r.status === 403);
  // تنظيف
  await ad.from("exam_attempts").delete().eq("student_id", stb.id);
  await ad.from("exam_questions").delete().eq("exam_id", exb.id);
  await ad.from("questions").delete().eq("id", qb.id);
  await ad.from("exams").delete().eq("id", exb.id);
  await ad.from("users").delete().eq("id", stb.id);
  await ad.from("tenants").delete().eq("id", tb.id);
  await ad.auth.admin.deleteUser(au.user.id);
  const { data: ua } = await ad.from("users").select("id").eq("auth_user_id", aua.user.id).single();
  if (ua) await ad.from("users").delete().eq("id", ua.id);
  await ad.auth.admin.deleteUser(aua.user.id);
  console.log(`CLEANED PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FATAL:" + e.message); process.exit(2); });
