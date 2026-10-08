import { NextResponse } from "next/server";

/**
 * أخطاء آمنة: تُسجَّل التفاصيل في سجلات الخادم فقط،
 * ويصل العميل رمز عام لا يكشف بنية قاعدة البيانات أو المزوّد.
 */
/** تنقية البيانات الشخصية قبل مغادرة الخادم: أرقام الموبايل (مصرية/دولية) والإيميلات.
 * أخطاء Postgres تتضمن القيم المخالفة نصاً (مثل Key (phone)=(01...) already exists)
 * وإرسالها لـSentry SaaS خارجي = تسريب PII. التفاصيل الكاملة تبقى في console المحلي فقط.
 * ملاحظة للمستقبل: لا يوجد عمود رقم قومي اليوم — لو أُضيف (14 رقماً) أضف نمطه هنا. */
function scrubPii(s: string): string {
  return s
    .replace(/(?:\+201\d{9}|201\d{9}|01\d{9})/g, "[PHONE]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .slice(0, 500);
}

export function logError(scope: string, err: unknown): void {
  try {
    const e = err as any;
    const full = String(e?.message ?? e);
    console.error(`[api:${scope}]`, e?.code ?? "", full.slice(0, 300));
    // Sentry: كل أخطاء الخادم (امتحان/دفع/غيرها) تصل للمراقبة تلقائياً — صامتة بلا DSN.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs").then((S) => {
        try { S.captureException(new Error(scrubPii(full)), { tags: { scope } }); } catch {}
      }).catch(() => {});
    }
  } catch {}
}

/** رد 500 آمن: تسجيل داخلي + رمز عام للعميل */
export function dbFail(scope: string, err: unknown, code = "server_error", status = 500) {
  logError(scope, err);
  return NextResponse.json({ ok: false, error: code }, { status });
}
