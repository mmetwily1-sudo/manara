import { getDemoHlsUrl } from "@/lib/bunny";

const DEMO_VIDEOS = [
  { id: "v1", title: "الوحدة الأولى — الحركة الخطية", visibility: "group", groups: ["مجموعة السبت"], duration: "42:15", thumb: "▶" },
  { id: "v2", title: "مراجعة قوانين نيوتن", visibility: "free", groups: ["الكل"], duration: "28:40", thumb: "▶" },
  { id: "v3", title: "حل امتحان 2024 التجريبي", visibility: "group", groups: ["مجموعة الأحد"], duration: "61:03", thumb: "🔒" },
];

export default function VideosPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الفيديوهات والكورسات</h1>
          <p className="mt-1 text-small text-slate-500">حصصك المسجلة — وصول متحكم به وعلامة مائية لكل طالب</p>
        </div>
        <button className="btn-primary text-small">رفع فيديو جديد</button>
      </header>

      <div className="card p-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-primary-light px-3 py-1 font-bold text-primary">الكل</span>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-600">مجاني</span>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-600">مجموعة</span>
        <span className="ml-auto text-slate-400">وضع التجربة: {getDemoHlsUrl().slice(0, 30)}…</span>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {DEMO_VIDEOS.map((v) => (
          <li key={v.id} className="card overflow-hidden p-0">
            <div className="flex aspect-video items-center justify-center bg-slate-900 text-4xl text-white/80">{v.thumb}</div>
            <div className="p-4">
              <div className="text-small font-bold">{v.title}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span>{v.duration}</span>
                <span>·</span>
                <span className={v.visibility === "free" ? "text-success" : "text-primary"}>{v.visibility === "free" ? "مجاني" : "لمجموعة"}</span>
                <span>·</span>
                <span>{v.groups.join(", ")}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={`/watch/${v.id}`} className="btn-primary !px-4 !py-1.5 text-xs">مشاهدة</a>
                <button className="btn-secondary !px-4 !py-1.5 text-xs">تعديل الوصول</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="card bg-primary-light/40 p-4 text-small text-slate-600">
        <b>حماية:</b> كل تشغيل يصدر برابط موقع 15 دقيقة + علامة مائية باسم الطالب فوق الفيديو — يمنع مشاركة الروابط.
      </div>
    </div>
  );
}
