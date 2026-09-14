"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "tus-js-client";

type Video = {
  id: string; title: string; visibility: string; group_ids: string[];
  created_at: string; source: "bunny" | "youtube" | "unknown"; youtubeId: string | null;
};

type Tab = "upload" | "youtube";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB حد أمان للرفع من المتصفح

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<Tab>("upload");
  const [filter, setFilter] = useState("");

  // نموذج الرفع من الجهاز
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("group");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "authorizing" | "uploading" | "verifying" | "done" | "error">("idle");
  const uploadRef = useRef<Upload | null>(null);

  // نموذج يوتيوب
  const [ytTitle, setYtTitle] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [ytBusy, setYtBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/videos");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setErr(j?.error === "unauth" ? "سجّل دخولك أولاً." : "تعذر تحميل الفيديوهات."); return; }
      setVideos(j.videos);
      setErr("");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => () => { try { uploadRef.current?.abort(); } catch {} }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOkMsg("");
    if (!file) { setErr("اختر ملف فيديو من جهازك أولاً."); return; }
    if (file.size > MAX_FILE_BYTES) { setErr("الملف أكبر من 2GB — قسّمه لأجزاء أصغر."); return; }
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
      setErr("اختر ملف فيديو صالح (mp4, mov, webm).");
      return;
    }
    setPhase("authorizing");
    setProgress(0);
    try {
      // 1) تفويض من السيرفر (بدون كشف أي مفاتيح)
      const a = await fetch("/api/videos/upload-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), visibility }),
      });
      const aj = await a.json().catch(() => null);
      if (!a.ok || !aj?.ok) {
        const msg = aj?.error === "bunny_not_configured"
          ? "الرفع المباشر غير مفعّل حالياً — استخدم تبويب «رابط يوتيوب» بدلاً منه."
          : `فشل تجهيز الرفع: ${aj?.error ?? aj?.message ?? "خطأ غير معروف"}`;
        setErr(msg); setPhase("error"); setProgress(null);
        return;
      }

      // 2) الرفع المباشر إلى Bunny (tus قابل للاستئناف — آمن مع انقطاع النت)
      setPhase("uploading");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: aj.tusEndpoint,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 8 * 1024 * 1024,
          metadata: { filename: file.name, filetype: file.type || "video/mp4" },
          headers: {
            AuthorizationSignature: aj.authSignature,
            AuthorizationExpire: String(aj.authExpire),
            VideoId: aj.videoGuid,
            LibraryId: String(aj.libraryId),
          },
          onError: (e) => reject(e),
          onProgress: (sent, total) => setProgress(total ? Math.round((sent / total) * 100) : null),
          onSuccess: () => resolve(),
        });
        uploadRef.current = upload;
        upload.start();
      });

      // 3) تأكيد الاكتمال (السيرفر يتحقق من وجود الملف فعلياً في Bunny)
      setPhase("verifying");
      const c = await fetch("/api/videos/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: aj.videoId }),
      });
      const cj = await c.json().catch(() => null);
      if (!c.ok || !cj?.ok) {
        setErr(cj?.message ?? `فشل التأكيد: ${cj?.error ?? "خطأ غير معروف"}`);
        setPhase("error"); setProgress(null);
        return;
      }
      setPhase("done"); setProgress(100);
      setOkMsg("تم رفع الفيديو بنجاح — قد يحتاج دقائق للتحويل قبل التشغيل الأمثل.");
      setTitle(""); setFile(null);
      load();
    } catch (e: any) {
      const aborted = String(e?.message ?? e).toLowerCase().includes("abort");
      setErr(aborted ? "تم إلغاء الرفع." : "انقطع الاتصال أثناء الرفع — أعد المحاولة (الرفع قابل للاستئناف).");
      setPhase("error"); setProgress(null);
    }
  }

  async function onYoutube(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOkMsg("");
    if (!ytTitle.trim() || !ytUrl.trim()) { setErr("اكتب العنوان ورابط يوتيوب."); return; }
    setYtBusy(true);
    try {
      const r = await fetch("/api/videos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ytTitle.trim(), visibility, youtubeUrl: ytUrl.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setErr(j?.error === "bad_youtube_url" ? "رابط يوتيوب غير صالح — الصق رابط مشاهدة أو Shorts صحيح." : `فشل الحفظ: ${j?.error ?? "خطأ غير معروف"}`);
        return;
      }
      setOkMsg("تمت إضافة فيديو يوتيوب بنجاح.");
      setYtTitle(""); setYtUrl("");
      load();
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setYtBusy(false); }
  }

  const visible = (videos ?? []).filter((v) => (!filter || v.visibility === filter));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الفيديوهات والكورسات</h1>
          <p className="mt-1 text-small text-slate-500">ارفع من جهازك مباشرة أو أضف رابط يوتيوب — مع وصول متحكم به</p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-small">رفع فيديو جديد</button>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}
      {okMsg && <div className="card border-success/20 bg-success/5 p-4 text-small font-bold text-success">{okMsg}</div>}

      {showAdd && (
        <div className="card p-5">
          <div className="mb-4 flex gap-2">
            {([
              ["upload", "📤 رفع من الجهاز"],
              ["youtube", "▶ رابط يوتيوب"],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} type="button" onClick={() => { setTab(t); setErr(""); setOkMsg(""); }}
                className={`rounded-xl px-4 py-2 text-small font-bold transition ${tab === t ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "upload" ? (
            <form onSubmit={onUpload} className="grid gap-3 sm:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الفيديو / الحصة" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5">
                <option value="group">لمجموعة محددة</option>
                <option value="free">مجاني للجميع</option>
              </select>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-small font-bold text-slate-600 transition hover:border-primary hover:text-primary">
                {file ? `📎 ${file.name} (${(file.size / 1048576).toFixed(1)}MB)` : "اختر ملف الفيديو (حتى 2GB)"}
                <input type="file" accept="video/*,.mkv,.avi,.mov" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {progress !== null && (
                <div className="sm:col-span-2">
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {phase === "authorizing" && "جاري تجهيز الرفع..."}
                    {phase === "uploading" && `جاري الرفع... ${progress}% (آمن مع انقطاع النت)`}
                    {phase === "verifying" && "تم الرفع — جاري التأكيد..."}
                    {phase === "done" && "اكتمل ✓"}
                    {phase === "error" && "توقف — راجع الرسالة بالأعلى"}
                  </p>
                </div>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button className="btn-primary flex-1" disabled={phase === "uploading" || phase === "authorizing" || phase === "verifying"}>
                  {phase === "uploading" ? "جاري الرفع..." : "ابدأ الرفع"}
                </button>
                {(phase === "uploading") && (
                  <button type="button" className="btn-secondary"
                    onClick={() => { try { uploadRef.current?.abort(); } catch {} }}>
                    إلغاء
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 sm:col-span-2">يُرفع الملف مباشرة إلى التخزين السحابي — لا يمر عبر سيرفراتنا، والرفع يُستأنف تلقائياً عند انقطاع النت.</p>
            </form>
          ) : (
            <form onSubmit={onYoutube} className="grid gap-3 sm:grid-cols-2">
              <input value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} placeholder="عنوان الفيديو / الحصة" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
              <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="الصق رابط يوتيوب (مشاهدة / Shorts / youtu.be)" required dir="ltr"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-left outline-none focus:border-primary sm:col-span-2" />
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5">
                <option value="group">لمجموعة محددة</option>
                <option value="free">مجاني للجميع</option>
              </select>
              <button className="btn-primary" disabled={ytBusy}>{ytBusy ? "جاري الحفظ..." : "إضافة الفيديو"}</button>
              <p className="text-xs text-slate-400 sm:col-span-2">يُشغَّل داخل المنصة بمشغل يوتيوب المضمّن — مع الالتزام بإعدادات الظهور التي تختارها أنت على يوتيوب.</p>
            </form>
          )}
        </div>
      )}

      <div className="card flex flex-wrap gap-2 p-3 text-xs">
        {[
          ["", "الكل"],
          ["free", "مجاني"],
          ["group", "مجموعة"],
        ].map(([v, l]) => (
          <button key={l} onClick={() => setFilter(v)} className={`rounded-full px-3 py-1 font-bold ${filter === v ? "bg-primary-light text-primary" : "bg-slate-50 text-slate-600"}`}>{l}</button>
        ))}
      </div>

      {videos === null ? (
        <div className="card p-8 text-center text-slate-400">جاري تحميل الفيديوهات...</div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لا توجد فيديوهات بعد — ارفع أول حصة بالزر بالأعلى.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((v) => (
            <li key={v.id} className="card overflow-hidden p-0">
              <div className="flex aspect-video items-center justify-center bg-slate-900 text-4xl text-white/80">
                {v.source === "youtube" ? "▶️" : "▶"}
              </div>
              <div className="p-4">
                <div className="text-small font-bold">{v.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold">
                    {v.source === "youtube" ? "يوتيوب" : "رفع مباشر"}
                  </span>
                  <span className={v.visibility === "free" ? "text-success" : "text-primary"}>{v.visibility === "free" ? "مجاني" : "لمجموعة"}</span>
                  <span>·</span>
                  <span>{new Date(v.created_at).toLocaleDateString("ar-EG")}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <a href={`/watch/${v.id}`} className="btn-primary !px-4 !py-1.5 text-xs">مشاهدة</a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="card bg-primary-light/40 p-4 text-small text-slate-600">
        <b>حماية:</b> فيديوهات الرفع المباشر تُشغَّل برابط موقع 15 دقيقة + علامة مائية باسم الطالب فوق الفيديو — يمنع مشاركة الروابط.
      </div>
    </div>
  );
}
