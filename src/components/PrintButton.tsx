"use client";

/** زر طباعة (للصفحات الخادمية) */
export function PrintButton({ label = "🖨️ طباعة البطاقة" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary w-full !py-2.5 text-small">
      {label}
    </button>
  );
}
