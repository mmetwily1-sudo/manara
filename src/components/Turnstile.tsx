"use client";

import { useEffect, useRef } from "react";
// ملاحظة أمنية: لا نستورد lib/captcha هنا أبداً — حتى لا يُخبز السر في حزمة المتصفح.
// المفتاح العام فقط (NEXT_PUBLIC_*) آمن للعميل.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * ودجت Cloudflare Turnstile — لا يظهر إطلاقاً بدون NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 * onToken(token) يُستدعى عند نجاح التحقق البشري.
 */
declare global {
  interface Window { turnstile?: any }
}

export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const siteKey = SITE_KEY.trim();
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !ref.current) return;
      try {
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(""),
          "error-callback": () => cb.current(""),
        });
      } catch {}
    };
    if (window.turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
      try { if (widgetId && window.turnstile) window.turnstile.remove(widgetId); } catch {}
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="flex justify-center" />;
}
