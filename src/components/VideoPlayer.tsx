"use client";

import { useRef, useState } from "react";

/**
 * مشغل فيديو محمي — HLS + علامة مائية باسم الطالب
 * skill: video-hosting-protection (watermark + signed token)
 */
export function VideoPlayer({
  src,
  watermark,
  onProgress,
}: {
  src: string;
  watermark?: string;
  onProgress?: (seconds: number) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={ref}
        src={src}
        controls
        controlsList="nodownload"
        playsInline
        onTimeUpdate={(e) => onProgress?.(Math.floor((e.target as HTMLVideoElement).currentTime))}
        onContextMenu={(e) => e.preventDefault()}
        onError={() => setErr("تعذر تشغيل الفيديو — تحقق من الاتصال")}
        className="aspect-video w-full"
      />
      {watermark && (
        <div
          className="pointer-events-none absolute bottom-3 right-3 select-none rounded bg-black/55 px-2 py-1 text-[10px] font-mono font-bold text-white/80 backdrop-blur"
          dir="ltr"
        >
          {watermark}
        </div>
      )}
      {watermark && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-sm font-bold text-white/20">
          {watermark}
        </div>
      )}
      {err && <div className="absolute inset-x-0 bottom-12 mx-auto w-max rounded bg-danger px-3 py-1 text-xs font-bold text-white">{err}</div>}
    </div>
  );
}
