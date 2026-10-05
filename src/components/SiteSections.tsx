"use client";

import { useEffect, useState } from "react";
import type { SiteSection } from "@/lib/site-sections";

/** عدّاد تنازلي حي (جزيرة عميل داخل صفحة خادم) */
function Countdown({ target, label }: { target: string; label: string }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const end = new Date(target).getTime();
    if (isNaN(end)) { setLeft(""); return; }
    const tick = () => {
      const d = end - Date.now();
      if (d <= 0) { setLeft("بدأ الآن 🎉"); return; }
      const days = Math.floor(d / 864e5);
      const h = Math.floor((d % 864e5) / 36e5);
      const m = Math.floor((d % 36e5) / 6e4);
      const s = Math.floor((d % 6e4) / 1000);
      setLeft(days > 0 ? `${days} يوم · ${h} ساعة · ${m} دقيقة` : `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!left) return null;
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-2xl border-2 border-dashed border-primary/40 bg-white p-6 text-center">
      {label && <p className="font-bold">{label}</p>}
      <p className="mt-2 font-mono text-3xl font-extrabold text-primary" dir="ltr">{left}</p>
    </div>
  );
}

/** رقم متحرك عند الظهور (إنجازات) */
function StatNum({ num, suffix }: { num: number; suffix: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200);
      setV(Math.round(num * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [num]);
  return <span className="font-mono text-3xl font-extrabold text-primary" dir="ltr">{v.toLocaleString("ar-EG")}{suffix}</span>;
}

/** عارض أقسام السنتر — بيانات منقاة خادمياً فقط */
export function SiteSections({ sections, card, accent }: { sections: SiteSection[]; card: string; accent?: string }) {
  const vis = sections.filter((s) => s.visible !== false);
  const accentOk = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : undefined;
  if (!vis.length) return null;
  return (
    <div className="mt-14 space-y-8 text-right">
      {vis.map((s) => {
        const d = s.data as any;
        switch (s.type) {
          case "announcement":
            return d.text ? (
              <div key={s.id} className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-small font-bold text-white">📢 {d.text}</div>
            ) : null;
          case "hero_custom":
            return (
              <div key={s.id} className="text-center">
                {d.title && <h2 className="text-h1 font-extrabold">{d.title}</h2>}
                {d.subtitle && <p className="mx-auto mt-2 max-w-xl text-body opacity-70">{d.subtitle}</p>}
                {d.cta_text && d.cta_url && (
                  <a href={String(d.cta_url).startsWith("http") ? d.cta_url : `https://${d.cta_url}`} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-block">
                    {d.cta_text}
                  </a>
                )}
              </div>
            );
          case "features":
            return Array.isArray(d.items) && d.items.length ? (
              <div key={s.id} className="grid gap-3 sm:grid-cols-3">
                {d.items.map((it: any, i: number) => (
                  <div key={i} className={card}>
                    {it.icon && <div className="text-3xl">{it.icon}</div>}
                    <h3 className="mt-2 font-bold">{it.title}</h3>
                    {it.desc && <p className="mt-1 text-small opacity-70">{it.desc}</p>}
                  </div>
                ))}
              </div>
            ) : null;
          case "countdown":
            return d.target ? <Countdown key={s.id} target={String(d.target)} label={String(d.label ?? "")} /> : null;
          case "text":
            return (
              <div key={s.id} className={card}>
                {d.title && <h3 className="font-extrabold">{d.title}</h3>}
                {d.body && <p className="mt-2 whitespace-pre-line text-small leading-relaxed opacity-80">{d.body}</p>}
              </div>
            );
          case "cta":
            return d.title ? (
              <div key={s.id} className="rounded-2xl p-6 text-center text-white" style={{ backgroundColor: accentOk ?? "#1A73E8" }}>
                <h3 className="font-extrabold">{d.title}</h3>
                {d.button && (
                  <a href={d.url && String(d.url).startsWith("http") ? d.url : "#"} className="mt-3 inline-block rounded-xl bg-white px-6 py-2.5 font-bold text-primary">
                    {d.button}
                  </a>
                )}
              </div>
            ) : null;
          case "testimonials":
            return Array.isArray(d.items) && d.items.length ? (
              <div key={s.id} className="grid gap-3 sm:grid-cols-3">
                {d.items.map((it: any, i: number) => (
                  <div key={i} className={card}>
                    <p className="text-small leading-relaxed">“{it.text}”</p>
                    <p className="mt-2 text-xs font-bold opacity-60">— {it.name}</p>
                  </div>
                ))}
              </div>
            ) : null;
          case "faq":
            return Array.isArray(d.items) && d.items.length ? (
              <div key={s.id} className="space-y-2">
                <h3 className="text-center font-extrabold">❓ أسئلة شائعة</h3>
                {d.items.map((it: any, i: number) => (
                  <details key={i} className={card}>
                    <summary className="cursor-pointer font-bold">{it.q}</summary>
                    <p className="mt-2 text-small opacity-80">{it.a}</p>
                  </details>
                ))}
              </div>
            ) : null;
          case "gallery":
            return Array.isArray(d.images) && d.images.length ? (
              <div key={s.id} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {d.images.map((src: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" loading="lazy" className="h-32 w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null;
          case "stats":
            return Array.isArray(d.items) && d.items.length ? (
              <div key={s.id} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {d.items.map((it: any, i: number) => (
                  <div key={i} className={`${card} text-center`}>
                    <StatNum num={Number(it.num) || 0} suffix={String(it.suffix ?? "")} />
                    <p className="mt-1 text-small font-bold opacity-70">{it.label}</p>
                  </div>
                ))}
              </div>
            ) : null;
          case "custom_html":
            return null; // يُعرض داخل sandbox الصفحة (عزل كامل) — لا حقن مباشر أبداً
          default:
            return null;
        }
      })}
    </div>
  );
}
