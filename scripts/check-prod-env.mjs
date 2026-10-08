// بوابة النشر: تمنع وصول أعلام التطوير الخطيرة لبيئة الإنتاج.
// تُستدعى تلقائياً قبل كل build عبر `prebuild` في package.json.
// - تعمل فقط عندما VERCEL_ENV=production (معاينة/CI/محلي: تمرير صامت دائماً).
// - أي فشل هنا يُسقط الـbuild بـexit 1 قبل أن يُبنى أي شيء — fail-closed.
const FAILURES = [];

function forbid(name, test, why) {
  if (test) FAILURES.push(`${name}: ${why}`);
}

// OTP صريح في رد الـAPI — ممنوع في الإنتاج (الحماية البرمجية موجودة أصلاً في
// otpPassthroughAllowed، وهذا خط دفاع إجرائي ثانٍ ضد تسرّب القيمة نفسها).
forbid(
  "OTP_DEV_PASSTHROUGH",
  process.env.VERCEL_ENV === "production" && process.env.OTP_DEV_PASSTHROUGH === "true",
  "يُرجع رموز OTP صريحة في رد الـAPI — أزل القيمة من Production Environment Variables"
);

if (FAILURES.length) {
  console.error("[deploy-gate] BLOCKED production build:");
  for (const f of FAILURES) console.error("  - " + f);
  process.exit(1);
}
console.log("[deploy-gate] ok");
