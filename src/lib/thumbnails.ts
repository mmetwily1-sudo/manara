/**
 * صور أغلفة الفيديوهات — بدون أي ترحيل لقاعدة البيانات.
 * الاتفاقية: thumbnails/{tenant_id}/{videoId}.{ext} في bucket عام.
 * لا يُخزَّن أي مسار في جدول videos؛ يُكتشف بالسرد (list) عند الحاجة.
 */

export const THUMBNAIL_BUCKET = "thumbnails";

/** أسماء كل ملفات الغلاف المحتملة لفيديو (لامتدادات مختلفة) */
export async function findThumbnailFiles(admin: any, tenantId: string, videoId: string): Promise<string[]> {
  const { data: files } = await admin.storage.from(THUMBNAIL_BUCKET).list(tenantId, { search: videoId });
  return (files ?? [])
    .filter((f: any) => f.name.startsWith(`${videoId}.`))
    .map((f: any) => `${tenantId}/${f.name}`);
}

export async function removeThumbnails(admin: any, tenantId: string, videoId: string) {
  const targets = await findThumbnailFiles(admin, tenantId, videoId);
  if (targets.length) await admin.storage.from(THUMBNAIL_BUCKET).remove(targets);
}

export function thumbnailPath(tenantId: string, videoId: string, ext: string) {
  return `${tenantId}/${videoId}.${ext}`;
}

export function publicThumbnailUrl(supabaseUrl: string, tenantId: string, videoId: string, ext: string) {
  return `${supabaseUrl}/storage/v1/object/public/${THUMBNAIL_BUCKET}/${thumbnailPath(tenantId, videoId, ext)}`;
}

/** خريطة videoId → أول غلاف مخصص موجود، باستدعاء list واحد لكل سنتر */
export async function thumbnailMap(admin: any, supabaseUrl: string, tenantId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const { data: files } = await admin.storage.from(THUMBNAIL_BUCKET).list(tenantId, { limit: 1000 });
  for (const f of (files ?? []) as any[]) {
    const dot = f.name.lastIndexOf(".");
    if (dot <= 0) continue;
    const videoId = f.name.slice(0, dot);
    if (!map[videoId]) map[videoId] = publicThumbnailUrl(supabaseUrl, tenantId, videoId, f.name.slice(dot + 1));
  }
  return map;
}
