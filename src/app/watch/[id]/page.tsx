"use client";

import { useEffect, useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";

type Payload =
  | { ok: true; source: "bunny"; hls: string; live: boolean }
  | { ok: true; source: "youtube"; youtubeId: string; embedUrl: string; title?: string }
  | { ok: false; error?: string };

export default function WatchPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/videos/${params.id}`).then(async (r) => {
      const j = (await r.json().catch(() => null)) as Payload | null;
      if (j && j.ok) setData(j);
      else setErr(!j ? "خطأ شبكة" : (j as any).error === "excluded" ? "غير مصرح لك بمشاهدة هذا الفيديو" : "تعذر تحميل الفيديو");
    }).catch(() => setErr("خطأ شبكة"));
  }, [params.id]);

  if (err) return <div className="mx-auto max-w-3xl p-8 text-center text-danger">{err}</div>;
  if (!data) return <div className="mx-auto max-w-3xl p-8 text-center text-slate-400">جاري تحميل المشغل...</div>;
  if (!data.ok) return <div className="mx-auto max-w-3xl p-8 text-center text-danger">تعذر تحميل الفيديو</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <a href="/dashboard/videos" className="text-small text-primary">← كل الفيديوهات</a>

      {data.source === "youtube" ? (
        <>
          <div className="overflow-hidden rounded-xl bg-black">
            <iframe
              src={data.embedUrl}
              title={data.title ?? "فيديو يوتيوب"}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="card p-4">
            <h1 className="font-bold">{data.title ?? "مشاهدة يوتيوب"}</h1>
            <p className="mt-1 text-small text-slate-500">يُشغَّل عبر يوتيوب مباشرة.</p>
          </div>
        </>
      ) : (
        <>
          <VideoPlayer src={data.hls} watermark="demo-student · ID mr-xxxx" onProgress={() => {}} />
          <div className="card p-4">
            <h1 className="font-bold">المشاهدة محمية</h1>
            <p className="mt-1 text-small text-slate-500">التقدم يُحفظ تلقائياً — استكمل من آخر نقطة في أي وقت.</p>
          </div>
        </>
      )}
    </div>
  );
}
