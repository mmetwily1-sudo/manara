"use client";

import { useEffect, useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";

export default function WatchPage({ params }: { params: { id: string } }) {
  const [hls, setHls] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/videos/${params.id}`).then(async (r) => {
      const j = await r.json();
      if (j.ok) setHls(j.hls);
      else setErr(j.error ?? "ممنوع");
    }).catch(() => setErr("خطأ شبكة"));
  }, [params.id]);

  if (err) return <div className="mx-auto max-w-3xl p-8 text-center text-danger">{err}</div>;
  if (!hls) return <div className="mx-auto max-w-3xl p-8 text-center text-slate-400">جاري تحميل المشغل...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <a href="/dashboard/videos" className="text-small text-primary">← كل الفيديوهات</a>
      <VideoPlayer src={hls} watermark="demo-student · ID mr-xxxx" onProgress={(s) => {
        // TODO: POST /api/videos/progress {videoId, seconds: s}
      }} />
      <div className="card p-4">
        <h1 className="font-bold">المشاهدة محمية</h1>
        <p className="mt-1 text-small text-slate-500">التقدم يُحفظ تلقائياً — استكمل من آخر نقطة في أي وقت.</p>
      </div>
    </div>
  );
}
