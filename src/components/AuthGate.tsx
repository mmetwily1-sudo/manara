"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/** حارس المصادقة — يحمي صفحات اللوحة ويوجه للدخول */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "deny">("checking");

  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => {
      setState(data?.session ? "ok" : "deny");
    }).catch(() => setState("deny"));
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-small text-slate-400">
        جاري التحقق من الجلسة...
      </div>
    );
  }
  if (state === "deny") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-h1">🔐</div>
        <h2 className="text-h2 font-bold">الدخول مطلوب</h2>
        <p className="max-w-xs text-small text-slate-500">سجّل دخولك للوصول إلى لوحة سنترك</p>
        <a href="/login" className="btn-primary">تسجيل الدخول</a>
      </div>
    );
  }
  return <>{children}</>;
}

/** زرار خروج صغير للاستخدام في الهيدرات */
export function SignOutButton({ className }: { className?: string }) {
  const sb = createClient();
  return (
    <button
      onClick={async () => { await sb.auth.signOut(); window.location.href = "/"; }}
      className={className ?? "text-xs font-semibold text-slate-400 transition hover:text-danger"}
    >
      خروج
    </button>
  );
}
