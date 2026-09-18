/**
 * إنشاء bucket الصور المصغرة (عام للقراءة) — آمن للتكرار
 * الاستخدام: node scripts/setup-thumbnails-bucket.mjs
 */
import { readFileSync } from "node:fs";
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

const { data, error } = await sb.storage.createBucket("thumbnails", {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
});
if (error && !/already exists|duplicate|23505/i.test(error.message)) {
  console.error("FAILED:", error.message);
  process.exit(1);
}
console.log("OK: bucket 'thumbnails' ready (public)");
