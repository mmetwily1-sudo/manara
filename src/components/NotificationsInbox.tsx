"use client";

import { useEffect, useState } from "react";

type Item = { icon: string; title: string; body: string; at: string; channel: string };

function timeAgo(iso: string): string {
  try {
    const d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (d < 1) return "الآن";
    if (d < 60) return `منذ ${Math.floor(d)} دقيقة`;
    if (d < 1440) return `منذ ${Math.floor(d / 60)} ساعة`;
    const days = Math.floor(d / 1440);
    return days === 1 ? "أمس" : `منذ ${days} أيام`;
  } catch { return ""; }
}

/**
 * صندوق التنبيهات — يعمل لـ100% من العملاء بلا تفعيل ولا اشتراك ولا قنوات.
 * src: /api/parent/notifications (ولي الأمر) أو /api/me/notifications (الطالب)
 */
export function NotificationsInbox({ source }: { source: "parent" | "me" }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const r = await fetch(source === "parent" ? "/api/parent/notifications" : "/api/me/notifications", { credentials: "include" });
        const j = await r.json().catch(() => null);
        if (!stop && r.ok && j?.ok) setItems(j.items ?? []);
      } catch {}
    })();
    return () => { stop = true; };
  }, [source]);

  if (items === null) return null;
  if (!items.length) return null;

  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-bold">🔔 آخر التنبيهات</h2>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <span className="text-xl" aria-hidden>{it.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-small font-bold">{it.title}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(it.at)}</span>
              </div>
              {it.body && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{it.body}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
