import { NextResponse } from "next/server";

/**
 * أخطاء آمنة: تُسجَّل التفاصيل في سجلات الخادم فقط،
 * ويصل العميل رمز عام لا يكشف بنية قاعدة البيانات أو المزوّد.
 */
export function logError(scope: string, err: unknown): void {
  try {
    const e = err as any;
    console.error(`[api:${scope}]`, e?.code ?? "", String(e?.message ?? e).slice(0, 300));
    // Sentry: كل أخطاء الخادم (امتحان/دفع/غيرها) تصل للمراقبة تلقائياً — صامتة بلا DSN.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs").then((S) => {
        try { S.captureException(e instanceof Error ? e : new Error(String(e?.message ?? e)), { tags: { scope } }); } catch {}
      }).catch(() => {});
    }
  } catch {}
}

/** رد 500 آمن: تسجيل داخلي + رمز عام للعميل */
export function dbFail(scope: string, err: unknown, code = "server_error", status = 500) {
  logError(scope, err);
  return NextResponse.json({ ok: false, error: code }, { status });
}
