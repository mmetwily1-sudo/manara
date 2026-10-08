// مراقبة أخطاء المتصفح — لا يعمل بدون NEXT_PUBLIC_SENTRY_DSN (آمن للغياب).
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.05, // عيّنات أداء قليلة حفاظاً على الحصة المجانية
    replaysOnErrorSampleRate: 0, // معطّل عمداً: خصوصية الطلاب أولاً
    enabled: process.env.NODE_ENV === "production",
  });
}
