"use client";

import { useEffect, useState } from "react";

/** شريط حالة الاتصال — يظهر فور الانقطاع ويختفي عند العودة */
export function OnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div className="sticky top-0 z-40 bg-warning px-4 py-2 text-center text-small font-bold text-white" role="alert">
      📡 لا إنترنت — شغلك محفوظ على جهازك وهيتبعت لوحده لما يرجع
    </div>
  );
}
