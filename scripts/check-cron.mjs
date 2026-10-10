// بوابة الكرون: تمنع تعبيرات cron ترفضها Vercel صامتةً على Hobby.
// القاعدة (موثقة رسمياً): Hobby = مرة واحدة يومياً كحد أقصى لكل مهمة.
// أي تعبير قد ينفذ أكثر من مرة/يوم (دقيقة أو ساعة موسّعة: */n، قوائم، نطاقات)
// يُسقط الـbuild بـexit 1 بدل اكتشاف الرفض الصامت بعد الدفع (درس d05d758).
// ملاحظتا توقيت (مرجع مركزي — لا تُكرر عند كل مهمة):
// - كل جداول Vercel بتوقيت UTC دائماً (القاهرة = UTC+3 صيفاً). vercel.json ملف
//   JSON خالص بلا تعليقات، فهذا الملف هو المرجع المركزي.
// - خطة Hobby تضيف نافذة مرنة ±ساعة تقريباً على كل موعد — مقبول لمهامنا
//   (تذكير/تقرير/تدقيق، لا شيء لحظي) ولا يستحق توثيقاً عند كل مهمة.
// تُستدعى من `prebuild` مع بوابة البيئة. تقبل مسار ملف اختياري للاختبار:
//   node scripts/check-cron.mjs [path/to/vercel.json]
import fs from "node:fs";

function expand(field, min, max, label, expr) {
  const fail = (why) => { throw new Error(`${label}: "${field}" ${why} (في "${expr}")`); };
  const out = new Set();
  for (const part of field.split(",")) {
    let range = part, step = 1;
    if (part.includes("/")) {
      const [r, s] = part.split("/");
      range = r;
      step = Number(s);
      if (!Number.isInteger(step) || step < 1) fail("خطوة غير صالحة");
    }
    let lo, hi;
    if (range === "*") { lo = min; hi = max; }
    else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b > max || a > b) fail("نطاق غير صالح");
      lo = a; hi = b;
    } else {
      const v = Number(range);
      if (!Number.isInteger(v) || v < min || v > max) fail("قيمة غير مدعومة (مدى/أسماء/رموز خاصة مرفوضة)");
      lo = v; hi = v;
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

const file = process.argv[2] ?? new URL("../vercel.json", import.meta.url);
let spec;
try {
  spec = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`[cron-gate] BLOCKED: تعذر قراءة ${file}: ${e.message}`);
  process.exit(1);
}
const failures = [];
for (const job of spec.crons ?? []) {
  const expr = String(job.schedule ?? "").trim();
  const parts = expr.split(/\s+/);
  if (parts.length !== 5) {
    failures.push(`${job.path}: تعبير غير مكون من 5 حقول ("${expr}")`);
    continue;
  }
  try {
    const mins = expand(parts[0], 0, 59, "minutes", expr);
    const hours = expand(parts[1], 0, 23, "hours", expr);
    if (mins.size > 1 || hours.size > 1) {
      failures.push(`${job.path}: "${expr}" قد ينفذ ${mins.size * hours.size}×/يوم — الحد Hobby مرة واحدة (راجع الدرس d05d758)`);
    } else {
      console.log(`[cron-gate] ok: ${job.path} (${expr})`);
    }
  } catch (e) {
    failures.push(`${job.path}: ${e.message}`);
  }
}
if (failures.length) {
  console.error("[cron-gate] BLOCKED schedules:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("[cron-gate] ok");
