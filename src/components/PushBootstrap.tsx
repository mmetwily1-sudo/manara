"use client";

import { useEffect } from "react";

/** تسجيل الـservice worker مرة واحدة (صامت — بلا واجهة) */
export function PushBootstrap() {
  useEffect(() => {
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    } catch {}
  }, []);
  return null;
}
