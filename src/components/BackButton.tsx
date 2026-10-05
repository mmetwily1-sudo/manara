"use client";

import { useRouter } from "next/navigation";

/** زر الرجوع — يعود للصفحة السابقة، أو للوحة عند الدخول المباشر */
export function BackButton({ fallback = "/dashboard", dark = false }: { fallback?: string; dark?: boolean }) {
  const router = useRouter();
  function go() {
    try {
      if (window.history.length > 1) router.back();
      else router.push(fallback);
    } catch {
      router.push(fallback);
    }
  }
  return (
    <button onClick={go} aria-label="رجوع"
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold transition ${
        dark ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}>
      <span aria-hidden>→</span>
    </button>
  );
}
