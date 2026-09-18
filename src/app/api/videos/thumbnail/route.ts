import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { THUMBNAIL_BUCKET, publicThumbnailUrl, removeThumbnails, thumbnailPath } from "@/lib/thumbnails";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
}

async function getOwnedVideo(admin: any, tenantId: string, videoId: string) {
  const { data } = await admin.from("videos")
    .select("id")
    .eq("id", videoId).eq("tenant_id", tenantId).single();
  return data ?? null;
}

/**
 * POST /api/videos/thumbnail (multipart: videoId + file)
 * يرفع صورة غلاف مخصصة. يستبدل القديمة تلقائياً (لا يتامى).
 */
export async function POST(req: Request) {
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }
  const videoId = String(form.get("videoId") ?? "");
  const file = form.get("file");
  if (!videoId) return NextResponse.json({ ok: false, error: "videoId" }, { status: 400 });
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  }

  const vid = await getOwnedVideo(admin, urow.tenant_id, videoId);
  if (!vid) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const mime = (file as File).type || "application/octet-stream";
  const ext = ALLOWED_MIME[mime];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "bad_type", message: "الصيغ المقبولة: JPG أو PNG أو WebP أو GIF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large", message: "حجم الصورة يتجاوز 5MB" }, { status: 400 });
  }

  // حذف القديمة أولاً حتى لا تتامى ملفات بامتدادات مختلفة
  await removeThumbnails(admin, urow.tenant_id, videoId);

  const path = thumbnailPath(urow.tenant_id, videoId, ext);
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(THUMBNAIL_BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: true,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: "upload_failed", details: error.message.slice(0, 200) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, thumbnail_url: publicThumbnailUrl(SUPA_URL!, urow.tenant_id, videoId, ext) });
}

/** DELETE /api/videos/thumbnail?videoId= — إزالة الغلاف المخصص (والرجوع للتلقائي) */
export async function DELETE(req: Request) {
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const videoId = new URL(req.url).searchParams.get("videoId") ?? "";
  if (!videoId) return NextResponse.json({ ok: false, error: "videoId" }, { status: 400 });

  const vid = await getOwnedVideo(admin, urow.tenant_id, videoId);
  if (!vid) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await removeThumbnails(admin, urow.tenant_id, videoId);
  return NextResponse.json({ ok: true, removed: true });
}
