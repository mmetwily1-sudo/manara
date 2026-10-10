// مراقبة أخطاء الخادم — لا يعمل بدون NEXT_PUBLIC_SENTRY_DSN (آمن للغياب).
import * as Sentry from "@sentry/nextjs";

/**
 * إزالة الأسرار من أي URL قبل مغادرته للخارج: استدعاءات UptimeRobot للكرون
 * تحمل ?secret=، وتتبع Sentry (5% من الطلبات) يلتقط الـURL الكامل افتراضياً —
 * بدون هذه التنقية كان السر سيتسرب لخوادم Sentry خلال ساعات (حتمية حسابية
 * لا نظرية). نفس روح scrubPii() في api-error.ts، لقناة الـURLs.
 */
function stripSecretFromUrl(url: unknown): unknown {
  if (typeof url !== "string") return url;
  return url.replace(/([?&])secret=[^&]*/gi, "$1secret=[REDACTED]");
}

function scrubEventUrls(event: any): any {
  try {
    if (event?.request && typeof event.request === "object") {
      if (typeof event.request.url === "string") event.request.url = stripSecretFromUrl(event.request.url);
      const hdrs = (event.request as any).headers;
      if (hdrs && typeof hdrs === "object") {
        for (const k of Object.keys(hdrs)) {
          if (/auth/i.test(k)) (hdrs as any)[k] = "[REDACTED]";
        }
      }
    }
    const spans = (event as any)?.spans;
    if (Array.isArray(spans)) {
      for (const s of spans) {
        const d = (s as any)?.data;
        if (d && typeof d === "object") {
          for (const k of ["url", "http.url", "http.query"]) {
            if (typeof (d as any)[k] === "string") (d as any)[k] = stripSecretFromUrl((d as any)[k]);
          }
        }
      }
    }
  } catch {}
  return event;
}

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.05,
    enabled: process.env.NODE_ENV === "production",
    beforeSend: (event) => scrubEventUrls(event),
    beforeSendTransaction: (event) => scrubEventUrls(event),
  });
}
