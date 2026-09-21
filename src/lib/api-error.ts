import { NextResponse } from "next/server";

/**
 * أخطاء آمنة: تُسجَّل التفاصيل في سجلات الخادم فقط،
 * ويصل العميل رمز عام لا يكشف بنية قاعدة البيانات أو المزوّد.
 */
export function logError(scope: string, err: unknown): void {
  try {
    const e = err as any;
    console.error(`[api:${scope}]`, e?.code ?? "", String(e?.message ?? e).slice(0, 300));
  } catch {}
}

/** رد 500 آمن: تسجيل داخلي + رمز عام للعميل */
export function dbFail(scope: string, err: unknown, code = "server_error", status = 500) {
  logError(scope, err);
  return NextResponse.json({ ok: false, error: code }, { status });
}
