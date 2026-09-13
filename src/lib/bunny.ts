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
