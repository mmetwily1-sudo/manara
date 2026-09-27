"use client";

import { useEffect, useState } from "react";

/** آراء المعلمين الحقيقية (ثناء موثق من المنصة) — تُخفى إن لم توجد */
export default function Testimonials() {
  const [list, setList] = useState<{ text: string; name: string; center: string }[] | null>(null);

  useEffect(() => {
    fetch("/api/testimonials").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && (j.testimonials ?? []).length) setList(j.testimonials);
    }).catch(() => {});
  }, []);

  if (!list) return null;
  return (
    <section className="mx-auto mt-16 max-w-6xl">
      <h2 className="section-title">قالوا عن منارة 💬</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {list.map((t, i) => (
          <blockquote key={i} className="card space-y-2 p-5">
            <div className="text-warning">{"★".repeat(5)}</div>
            <p className="text-small leading-relaxed" dir="auto">“{t.text}”</p>
            <footer className="text-xs text-slate-500">— {t.name}{t.center ? ` · ${t.center}` : ""}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
