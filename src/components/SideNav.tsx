"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./MobileNav";

/** روابط السايدبار مع تمييز الصفحة النشطة */
export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path === href || path.startsWith(href + "/");
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-small font-semibold transition ${
              active
                ? "bg-gradient-to-l from-primary to-primary-dark text-white shadow-[0_8px_30px_-6px_rgba(26,115,232,0.35)]"
                : "text-slate-600 hover:bg-primary-light/50 hover:text-primary"
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`font-mono text-[11px] transition ${
                active ? "text-white/70" : "text-slate-300 group-hover:text-primary"
              }`}
            >
              {item.key}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
