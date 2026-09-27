"use client";

/** مشاركة الشهادة سوشيال — واتساب/فيسبوك/X */
export default function ShareCert({ title, name, center }: { title: string; name: string; center: string }) {
  const text = `🎓 شهادة إتمام: ${name} — ${title} (${center}) — موثقة من منصة منارة`;
  const u = (base: string) => `${base}${encodeURIComponent(`${text}\n${window.location.href}`)}`;
  return (
    <div className="mt-3 flex justify-center gap-2">
      <a href={u("https://wa.me/?text=")} target="_blank" rel="noreferrer" className="rounded-lg bg-success px-4 py-1.5 text-xs font-bold text-white">واتساب 💬</a>
      <a href={u("https://www.facebook.com/sharer/sharer.php?u=")} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white">فيسبوك 📘</a>
      <a href={u("https://twitter.com/intent/tweet?text=")} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white">X 🐦</a>
    </div>
  );
}
