"use client";

import { useEffect, useState } from "react";

/** زر تثبيت التطبيق (PWA) — يظهر فقط عندما يدعم المتصفح التثبيت */
export default function InstallPwa() {
  const [deferred, setDeferred] = useState<any>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const h = (e: any) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (done || !deferred) return null;
  return (
    <button
      onClick={async () => {
        try { deferred.prompt(); await deferred.userChoice; setDone(true); } catch {}
        setDeferred(null);
      }}
      className="btn-secondary text-small"
    >
      ثبّت التطبيق 📲
    </button>
  );
}
