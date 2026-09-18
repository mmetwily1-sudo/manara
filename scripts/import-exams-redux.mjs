/**
 * استيراد بنك EXAMS-Redux المفتوح (CC-BY-SA-4.0) إلى البنك المركزي المشترك.
 * المصدر: https://huggingface.co/datasets/inceptlabs/Arabic_EXAMS-Redux
 * آمن التكرار: يتخطى إن وُجدت أسئلة بنفس بادئة المرجع.
 *
 * الاستخدام:
 *   node scripts/import-exams-redux.mjs            (تشغيل فعلي)
 *   node scripts/import-exams-redux.mjs --dry      (معاينة فقط)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function env(name) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp("^" + name + "=(.+)$", "m"));
  if (!m) throw new Error("missing env " + name);
  return m[1].trim();
}

// English subject → مادة المناهج
const SUBJECT_MAP = {
  Biology: "أحياء",
  Physics: "فيزياء",
  Chemistry: "كيمياء",
  "Islamic Studies": "تربية دينية",
  Geology: "جيولوجيا",
  Mathematics: "رياضيات",
  History: "تاريخ",
  Geography: "جغرافيا",
  Philosophy: "فلسفة ومنطق",
  Psychology: "علم نفس واجتماع",
  Arabic: "لغة عربية",
  English: "لغة إنجليزية",
  Science: "علوم",
  Social: "دراسات اجتماعية",
};

const DS = "inceptlabs/Arabic_EXAMS-Redux";
const REF_PREFIX = "EXAMS-Redux CC-BY-SA-4.0";

async function fetchRows(offset, length) {
  const url =
    "https://datasets-server.huggingface.co/rows?dataset=" +
    encodeURIComponent(DS) +
    "&config=default&split=test&offset=" +
    offset +
    "&length=" +
    length;
  const r = await fetch(url);
  if (!r.ok) throw new Error("HF fetch failed: " + r.status);
  return r.json();
}

async function main() {
  const dry = process.argv.includes("--dry");
  const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  // idempotency: هل سبق الاستيراد؟
  const { data: existing } = await admin
    .from("questions")
    .select("id")
    .is("tenant_id", null)
    .like("source_detail", REF_PREFIX + "%")
    .limit(1);
  if (existing?.length) {
    console.log("already imported — skipping (found prior rows)");
    return;
  }

  // اجلب الكل
  let offset = 0;
  const all = [];
  for (;;) {
    const j = await fetchRows(offset, 100);
    all.push(...(j.rows || []).map((r) => r.row));
    if (all.length >= (j.num_rows_total || 0) || !(j.rows || []).length) break;
    offset += 100;
  }
  console.log("fetched rows:", all.length);

  const subjects = {};
  const docs = [];
  for (const row of all) {
    subjects[row.subject] = (subjects[row.subject] || 0) + 1;
    const ar = SUBJECT_MAP[row.subject];
    if (!ar) continue; // مادة غير مدعومة — تُسجَّل وتُتخطى
    const opts = [row.A, row.B, row.C, row.D].map((s) => String(s ?? "").trim()).filter(Boolean);
    if (!opts.length || !row.question?.trim()) continue;
    const idx = { A: 0, B: 1, C: 2, D: 3 }[row.answer];
    docs.push({
      tenant_id: null,
      subject: ar,
      lesson: null,
      lesson_code: null,
      difficulty: 3,
      qtype: "mcq",
      body: row.question.trim(),
      options: opts,
      correct_answer: idx != null && opts[idx] ? opts[idx] : null,
      marks: 1,
      source: "teacher",
      source_detail: REF_PREFIX + " | " + row.id,
      visibility: "shared",
      status: "approved",
    });
  }
  console.log("subjects in dataset:", JSON.stringify(subjects));
  console.log("mappable docs:", docs.length);

  if (dry) {
    console.log(JSON.stringify(docs.slice(0, 2), null, 2).slice(0, 800));
    return;
  }
  let inserted = 0;
  for (let i = 0; i < docs.length; i += 100) {
    const { error } = await admin.from("questions").insert(docs.slice(i, i + 100));
    if (error) throw new Error("insert failed: " + error.message);
    inserted += Math.min(100, docs.length - i);
  }
  console.log("inserted shared questions:", inserted);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
