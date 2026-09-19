/**
 * رفع ناتج pdf_ingest إلى التخزين + إنشاء مسودات للمراجعة البشرية.
 * المسودات (status=draft) لا تظهر إلا لمدير المنصة — لا شيء يُنشر تلقائياً.
 *
 * الاستخدام:
 *   node scripts/pdf_upload.mjs ./out/exam2024
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const outdir = process.argv[2];
if (!outdir) {
  console.error("usage: node scripts/pdf_upload.mjs <outdir>");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(join(outdir, "manifest.json"), "utf8"));

// 1) bucket عام لصور الصفحات
{
  const { error } = await sb.storage.createBucket("exam-pages", {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg"],
  });
  if (error && !/already exists|duplicate|23505/i.test(error.message)) throw new Error(error.message);
}

// 2) رفع الصفحات
const pagesDir = join(outdir, "pages");
for (const f of readdirSync(pagesDir).filter((x) => x.endsWith(".png"))) {
  const buf = readFileSync(join(pagesDir, f));
  const path = `drafts/${manifest.ref}/${f}`;
  const { error } = await sb.storage.from("exam-pages").upload(path, buf, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw new Error("upload " + f + ": " + error.message);
}
console.log("pages uploaded");

// 3) مسودات (تخطي المكرر بنفس المرجع)
const { data: prior } = await sb
  .from("questions")
  .select("id")
  .is("tenant_id", null)
  .eq("status", "draft")
  .like("source_detail", `%${manifest.ref}%`)
  .limit(1);
if (prior?.length) {
  console.log("drafts for this ref already exist — skipping");
  process.exit(0);
}

const OPT_LINE = /^\s*(?:\(?[أ-ي]\)|\(?[a-dA-D]\)|\(?\d+\)|[أ-ي]\.|[a-dA-D]\.|\d+\.)\s*\S/;
function stripMarker(s) {
  return s
    .replace(/^\s*\(?[أ-ي]\)\s*/, "")
    .replace(/^\s*\(?[a-dA-D]\)\s*/, "")
    .replace(/^\s*\(?\d+\)\s*/, "")
    .replace(/^\s*[أ-ي]\.\s*/, "")
    .replace(/^\s*\d+\.\s*/, "")
    .trim();
}
function splitQA(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let cut = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (OPT_LINE.test(lines[i])) cut = i;
    else if (cut >= 0) break;
  }
  if (cut <= 0) return { stem: String(text ?? "").trim(), options: [] };
  const options = [...new Set(lines.slice(cut).map(stripMarker).filter(Boolean))];
  const stem = lines.slice(0, cut).join("\n").trim();
  if (stem && options.length >= 2) return { stem, options };
  if (lines.length >= 2) {
    const dashed = lines[lines.length - 1].split(/\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
    if (dashed.length >= 2) {
      return { stem: lines.slice(0, -1).join("\n").trim(), options: [...new Set(dashed)] };
    }
  }
  return { stem: String(text ?? "").trim(), options: [] };
}
const rows = manifest.segments.map((s) => {
  const qa = splitQA(s.text);
  return {
    tenant_id: null,
    subject: manifest.subject || "عام",
    lesson: null,
    lesson_code: null,
    difficulty: 3,
    qtype: "mcq",
    body: qa.stem.slice(0, 2000) || s.text.slice(0, 2000),
    options: qa.options.length >= 2 ? qa.options : null,
    correct_answer: null,
    marks: 1,
    source: "teacher",
    source_detail: JSON.stringify({ ref: manifest.ref, page: s.page, kind: "pdf-draft" }),
    visibility: "shared",
    status: "draft",
  };
});
let n = 0;
for (let i = 0; i < rows.length; i += 50) {
  const { error } = await sb.from("questions").insert(rows.slice(i, i + 50));
  if (error) throw new Error("draft insert: " + error.message);
  n += Math.min(50, rows.length - i);
}
console.log("drafts created:", n, "| images at: exam-pages/drafts/" + manifest.ref + "/");

function pageUrl(draftRef, page) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/exam-pages/drafts/${draftRef}/p${String(page).padStart(3, "0")}.png`;
}
console.log("sample page:", pageUrl(manifest.ref, 1));
