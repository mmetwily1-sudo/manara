/**
 * Bunny Stream — خدمة الفيديو المحمي
 * المرجع: skill video-hosting-protection
 *
 * وضعان:
 * - LIVE: بمفاتيح Bunny (BUNNY_LIBRARY_ID + BUNNY_API_KEY) → إنشاء فيديو + توقيع تشغيل
 * - DEMO: بدون مفاتيح → يرجع معرفات وهمية ورابط تجريبي
 */
import crypto from "node:crypto";

const BUNNY_API = "https://api.bunny.net";
const LIB = process.env.BUNNY_LIBRARY_ID;
const KEY = process.env.BUNNY_API_KEY;
const CDN = process.env.BUNNY_CDN_HOSTNAME ?? "vz-da9b8b3a-000.b-cdn.net";
const TOKEN_KEY = process.env.BUNNY_TOKEN_KEY ?? "demo-token-key";

export function isBunnyLive() {
  return !!LIB && !!KEY;
}

export async function createBunnyVideo(title: string) {
  if (!isBunnyLive()) return { guid: `demo-${Date.now()}`, title };
  const res = await fetch(`${BUNNY_API}/videolibrary/${LIB}/videos`, {
    method: "POST",
    headers: { AccessKey: KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny create failed: ${res.status}`);
  return res.json() as Promise<{ guid: string; title: string }>;
}

/** توقيع رابط تشغيل قصير العمر (15 دقيقة) — يمنع مشاركة الرابط */
export function signPlaybackUrl(videoGuid: string, studentId: string, ttlSec = 900): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const tokenData = `${videoGuid}${studentId}${expires}`;
  const token = crypto.createHmac("sha256", TOKEN_KEY).update(tokenData).digest("hex");
  // صيغة Bunny المرنة: https://{CDN}/{guid}/playlist.m3u8?token=...&expires=...
  return `https://${CDN}/${videoGuid}/playlist.m3u8?token=${token}&expires=${expires}&sid=${studentId}`;
}

export function getDemoHlsUrl() {
  // فيديو تجريبي عام (Bunny sample) — يعمل بدون مفاتيح للمعاينة
  return "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
}

export const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

/**
 * توقيع رفع tus المصرّح به — يُولّد على السيرفر فقط (لا يُكشف AccessKey أبداً للعميل).
 * الصيغة حسب توثيق Bunny: sha256(libraryId + apiKey + expiration + videoId) ثم base64.
 */
export function signTusUpload(videoGuid: string, ttlSec = 3600): {
  libraryId: string;
  videoId: string;
  expires: number;
  signature: string;
} | null {
  if (!isBunnyLive()) return null;
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const raw = `${LIB}${KEY}${expires}${videoGuid}`;
  const signature = crypto.createHash("sha256").update(raw).digest("base64");
  return { libraryId: LIB!, videoId: videoGuid, expires, signature };
}

/** حذف كائن فيديو من مكتبة Bunny — best-effort (لا يرمي عند غياب المفاتيح، يرجع false) */
export async function deleteBunnyVideo(videoGuid: string): Promise<boolean> {
  if (!isBunnyLive() || !videoGuid || videoGuid.startsWith("demo-")) return true;
  try {
    const res = await fetch(`${BUNNY_API}/videolibrary/${LIB}/videos/${videoGuid}`, {
      method: "DELETE",
      headers: { AccessKey: KEY! },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** التحقق من حالة الفيديو في مكتبة Bunny (بعد اكتمال الرفع من العميل) */
export async function getBunnyVideoStatus(videoGuid: string): Promise<{
  ok: boolean;
  status?: number;
  statusText?: string;
} | null> {
  if (!isBunnyLive()) return null;
  const res = await fetch(`${BUNNY_API}/videolibrary/${LIB}/videos/${videoGuid}`, {
    headers: { AccessKey: KEY! },
  });
  if (res.status === 404) return { ok: false };
  if (!res.ok) throw new Error(`Bunny status check failed: ${res.status}`);
  const j = (await res.json()) as any;
  // 0=Created, 1=Uploaded, 2=Processing, 3=Finished transcoding steps, 4=Finished, 5=Failed, 6=PartiallyUploaded
  const names: Record<number, string> = {
    0: "created", 1: "uploaded", 2: "processing", 3: "transcoding",
    4: "finished", 5: "failed", 6: "partial",
  };
  return { ok: true, status: j.status, statusText: names[j.status] ?? String(j.status) };
}
