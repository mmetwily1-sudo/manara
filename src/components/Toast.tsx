"use client";

import { useEffect, useState } from "react";

type T = { id: number; kind: "success" | "error" | "info"; text: string };
let push: ((t: Omit<T, "id">) => void) | null = null;
let seq = 1;

/** إشعار عائم من أي مكان: toast("تم ✅", "success") */
export function toast(text: string, kind: T["kind"] = "success") {
  push?.({ kind, text });
}

export function ToastHost() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = seq++;
      setItems((p) => [...p.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3500);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl px-4 py-3 text-small font-bold text-white shadow-2xl ${
            t.kind === "success" ? "bg-success" : t.kind === "error" ? "bg-danger" : "bg-slate-800"
          }`}
        >
          <span>{t.kind === "success" ? "✅" : t.kind === "error" ? "⛔" : "ℹ️"}</span>
          <span className="flex-1" dir="auto">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
