/**
 * Video source convention (works WITHOUT any DB migration):
 * - Bunny videos: provider_video_id = "<guid>" (raw, backward compatible)
 * - YouTube videos: provider_video_id = "yt:<VIDEO_ID>"
 *
 * All readers MUST go through decodeSource() — never parse the raw value inline.
 */

export type VideoSource =
  | { kind: "bunny"; guid: string }
  | { kind: "youtube"; youtubeId: string }
  | { kind: "unknown" };

const YT_PREFIX = "yt:";

export function encodeYoutube(youtubeId: string): string {
  return `${YT_PREFIX}${youtubeId}`;
}

export function decodeSource(providerVideoId: string | null | undefined): VideoSource {
  if (!providerVideoId) return { kind: "unknown" };
  if (providerVideoId.startsWith(YT_PREFIX)) {
    const youtubeId = providerVideoId.slice(YT_PREFIX.length);
    if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return { kind: "youtube", youtubeId };
    return { kind: "unknown" };
  }
  return { kind: "bunny", guid: providerVideoId };
}

/** يستخرج YouTube video ID من كل الصيغ الشائعة، أو null */
export function parseYoutubeId(input: string): string | null {
  const url = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url; // ID مباشر
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** رابط التضمين الآمن ليوتيوب */
export function youtubeEmbedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;
}
