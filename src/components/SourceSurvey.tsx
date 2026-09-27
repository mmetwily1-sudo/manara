"use client";

import { useEffect, useState } from "react";

const SOURCES = ["ترشيح صديق 🤝", "فيسبوك 📘", "بحث جوجل 🔍", "تيك توك/ريلز 🎬", "أخرى ✍️"];

/** استبيان المصدر مرة واحدة: منين عرفت منارة؟ — يغذي قرارات التسويق */
export default function SourceSurvey() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("manara.source.v1")) return;
    } catch {}
    setShow(true);
  }, []);

  async function send(src: string) {
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "survey", text: `المصدر: ${src}`, page: "dashboard" }),
      });
      if (r.ok) {
        try { localStorage.setItem("manara.source.v1", "1"); } catch {}
        setDone(true); setShow(false);
      }
    } catch {}
  }

  if (done || !show) return null;
  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
      <span className="text-small font-bold">سؤال سريع 🌱 منين عرفت منارة؟</span>
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button key={s} onClick={() => send(s)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-primary hover:text-white">
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
