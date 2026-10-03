"use client";

import { useEffect, useState } from "react";

/**
 * كاشف متصفحات التطبيقات (واتساب/تليجرام/فيسبوك): دخول جوجل يفشل داخلها على iOS وأندرويد.
 * يظهر تنبيهاً يطلب الفتح في سفاري/كروم — وإلا سيظن العميل أن المنصة معطلة.
 */
export function InAppGuard() {
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const webview =
        /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Telegram|MicroMessenger|TikTok|Snapchat/i.test(ua) ||
        ((navigator as any).standalone === false && /iPhone|iPad/i.test(ua) && !/Safari/i.test(ua) && /AppleWebKit/i.test(ua));
      if (webview) setInApp(true);
    } catch {}
  }, []);

  if (!inApp) return null;
  return (
    <div className="rounded-xl border-2 border-warning/40 bg-warning/10 p-4 text-center">
      <p className="text-small font-bold">⚠️ أنت تتصفح من داخل تطبيق (واتساب/فيسبوك)</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        الموقع يعمل هنا بالكامل: سجّل بالبريد أو ادخل <b>برابط بريدي بدون باسورد</b> من الأسفل.
        زر جوجل فقط يحتاج سفاري/كروم — وستصلك بياناتك على أي حال.
      </p>
    </div>
  );
}
