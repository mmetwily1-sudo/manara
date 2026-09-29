"use client";

import Link from "next/link";
import { useState } from "react";

export type NavItem = { href: string; label: string; key: string };

/** شريط الجوال السفلي: 4 رئيسية + زر "المزيد" يفتح كل الأقسام */
export function MobileBottomNav({ main, more }: { main: NavItem[]; more: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {main.map((item) => (
          <Link key={item.label} href={item.href}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-slate-500 transition active:bg-slate-50">
            <span aria-hidden className="font-mono text-[10px] leading-none text-slate-300">{item.key}</span>
            {item.label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold text-primary transition active:bg-slate-50">
          <span aria-hidden className="text-base leading-none">☰</span>
          المزيد
        </button>
      </nav>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-200" />
            <h2 className="mb-3 text-small font-bold text-slate-500">كل الأقسام</h2>
            <div className="grid grid-cols-2 gap-2">
              {[...main, ...more].map((item) => (
                <Link key={item.href + item.label} href={item.href} onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-small font-bold text-slate-700 transition active:bg-primary-light">
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] text-slate-300">{item.key}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
