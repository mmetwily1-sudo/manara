"use client";

import { useEffect } from "react";

/** ورقة سفلية (Bottom Sheet) للتأكيدات والإجراءات السريعة — بديل confirm() */
export function Sheet({
  open,
  title,
  desc,
  confirmLabel = "تأكيد ✅",
  danger,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  desc?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-200" />
        <h2 className="text-center font-bold">{title}</h2>
        {desc && <p className="mt-1 text-center text-small text-slate-500" dir="auto">{desc}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onClose} className="btn-secondary !py-3">تراجع</button>
          <button
            onClick={onConfirm} disabled={busy}
            className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-50 ${danger ? "bg-danger" : "bg-gradient-to-b from-primary to-primary-dark"}`}
          >
            {busy ? "جاري..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
