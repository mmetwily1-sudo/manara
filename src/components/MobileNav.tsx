"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; key: string };

/** شريط الجوال السفلي: 4 رئيسية + زر "المزيد" يفتح كل الأقسام */
export function MobileBottomNav({ main, more }: { main: NavItem[]; more: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path === href || path.startsWith(href + "/");
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {main.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition active:bg-slate-50 ${active ? "text-primary" : "text-slate-500"}`}>
              <span aria-hidden className={`font-mono text-[10px] leading-none ${active ? "text-primary" : "text-slate-300"}`}>{item.key}</span>
              {item.label}
            </Link>
          );
        })}
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
              {[...main, ...more].map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href + item.label} href={item.href} onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-small font-bold transition active:bg-primary-light ${active ? "bg-gradient-to-l from-primary to-primary-dark text-white shadow-[0_8px_30px_-6px_rgba(26,115,232,0.35)]" : "bg-slate-50 text-slate-700"}`}>
                    <span>{item.label}</span>
                    <span className={`font-mono text-[10px] ${active ? "text-white/70" : "text-slate-300"}`}>{item.key}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
