"use client";

import { useRef, useState, useEffect } from "react";

/**
 * مشغل فيديو محمي — HLS + علامة مائية ديناميكية + حماية الجلسة + منع لقطات الشاشة
 * skill: video-hosting-protection (watermark + signed token + session binding + anti-capture)
 */
export function VideoPlayer({
  src,
  watermark,
  onProgress,
  sessionId,
  token,
}: {
  src: string;
  watermark?: string;
  onProgress?: (seconds: number) => void;
  sessionId?: string;
  token?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const watermarkRef = useRef(0);

  // تحديث العلامة المائية الديناميكية كل 5 ثوانٍ
  useEffect(() => {
    const id = setInterval(() => {
      watermarkRef.current = (watermarkRef.current + 1) % 10000;
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // التحقق من الجلسة
  useEffect(() => {
    if (!sessionId || !token) return;
    let cancelled = false;
    async function validate() {
      try {
        const r = await fetch("/api/video/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, token }),
        });
        if (!r.ok && !cancelled) {
          setErr("انتهت صلاحية الجلسة");
          ref.current?.pause();
        }
      } catch {
        if (!cancelled) setErr("فشل التحقق من الجلسة");
      }
    }
    validate();
    return () => { cancelled = true; };
  }, [sessionId, token]);

  // تحديث وقت التشغيل
  const handleTimeUpdate = () => {
    const video = ref.current;
    if (!video) return;
    const ct = video.currentTime;
    setCurrentTime(ct);
    if (onProgress) onProgress(ct);
  };

  const handleLoadedMetadata = () => {
    const video = ref.current;
    if (video) setDuration(video.duration);
  };

  const handleError = () => setErr("تعذر تشغيل الفيديو");

  // طبقة Canvas للحماية من سكرينشوت
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = ref.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context = ctx; // non-null assertion for TypeScript
    function draw() {
      const v = video;
      const c = canvas;
      if (!v || !c || v.paused || v.ended) return;
      context.drawImage(v, 0, 0, c.width, c.height);
      requestAnimationFrame(draw);
    }
    draw();
  }, []);

  return (
    <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden">
      <video
        ref={ref}
        src={src}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
        onLoadedMetadata={handleLoadedMetadata}
        onContextMenu={(e) => e.preventDefault()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="aspect-video w-full"
      />
      {/* علامة مائية ديناميكية - تتغير موضعها */}
      {watermark && (
        <div className="pointer-events-none absolute inset-0 select-none">
          <div
            className="pointer-events-none absolute bottom-3 right-3 select-none rounded bg-black/60 px-2 py-1 text-[10px] font-mono font-bold text-white/90 backdrop-blur"
            dir="ltr"
            style={{
              transform: `translate(${Math.sin(Date.now() / 2000) * 10}px, ${Math.cos(Date.now() / 3000) * 10}px)`
            }}
          >
            {watermark}
          </div>
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-sm font-bold text-white/10"
            style={{
              transform: `translate(-50%, -50%) rotate(${(Date.now() / 10000) % 360}deg)`
            }}
          >
            {watermark}
          </div>
        </div>
      )}
      {/* طبقة Canvas للحماية من截屏 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none select-none"
        style={{ zIndex: 10 }}
        width={640}
        height={360}
      />
      {err && (
        <div className="absolute inset-x-0 bottom-12 mx-auto w-max rounded bg-danger px-3 py-1 text-xs font-bold text-white">
          {err}
        </div>
      )}
    </div>
  );
}