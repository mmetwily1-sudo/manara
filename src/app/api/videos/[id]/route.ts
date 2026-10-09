import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { deleteBunnyVideo, getDemoHlsUrl, signPlaybackUrl, isBunnyLive } from "@/lib/bunny";
import { decodeSource, encodeYoutube, parseYoutubeId, youtubeEmbedUrl } from "@/lib/video-source";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const admin = SUPA_URL ? createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null;
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const { data: urow } = await admin.from("users")
    .select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow?.tenant_id) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const { data: vid } = await admin.from("videos")
    .select("title,tenant_id,provider_video_id,visibility,group_ids,excluded_student_ids")
    .eq("id", params.id).single();
  // 404 موحد: لا نكشف عن وجود فيديو من سنتر آخر
  if (!vid?.provider_video_id || vid.tenant_id !== urow.tenant_id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const excluded = (vid.excluded_student_ids as string[] | null) ?? [];
  if (excluded.includes(urow.id)) {
    return NextResponse.json({ ok: false, error: "excluded" }, { status: 403 });
  }

  // فيديو مجموعة: الطالب يجب أن يكون مسجلاً في إحدى مجموعات الفيديو (المعلم يتجاوز)
  if (vid.visibility === "group" && urow.role !== "teacher_admin") {
    const allowedGroups = (vid.group_ids as string[] | null) ?? [];
    if (!allowedGroups.length) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const { data: enr } = await admin.from("enrollments")
      .select("id").eq("student_id", urow.id).in("group_id", allowedGroups).limit(1);
    if (!enr?.length) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const src = decodeSource(vid.provider_video_id);
  if (src.kind === "youtube") {
    return NextResponse.json({ ok: true, source: "youtube", youtubeId: src.youtubeId, embedUrl: youtubeEmbedUrl(src.youtubeId), title: (vid as any).title });
  }
  if (src.kind === "bunny") {
    const hls = isBunnyLive() ? signPlaybackUrl(src.guid, user.id) : getDemoHlsUrl();
    return NextResponse.json({ ok: true, source: "bunny", hls, live: isBunnyLive() });
  }
  return NextResponse.json({ ok: false, error: "bad_source" }, { status: 422 });
}

/** PATCH /api/videos/[id] — تعديل بيانات الفيديو (العنوان، الظهور، المجموعات، رابط يوتيوب) */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = SUPA_URL ? createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null;
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const { data: urow } = await admin.from("users").select("tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  if ((urow as any).role !== "teacher_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(admin, urow.tenant_id, (urow as any).role);
  if (_sw) return _sw;

  const { data: vid } = await admin.from("videos")
    .select("id,tenant_id,provider_video_id")
    .eq("id", params.id).eq("tenant_id", urow.tenant_id).single();
  if (!vid) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const patch: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim().length >= 2) {
    patch.title = body.title.trim();
  }
  if (body.visibility === "group" || body.visibility === "free") {
    patch.visibility = body.visibility;
  }
  if (Array.isArray(body.group_ids)) {
    patch.group_ids = body.group_ids.filter((g: unknown) => typeof g === "string");
  }
  if (Array.isArray(body.excluded_student_ids)) {
    patch.excluded_student_ids = body.excluded_student_ids.filter((s: unknown) => typeof s === "string");
  }
  // تغيير رابط يوتيوب مسموح فقط لفيديوهات يوتيوب أصلاً (لا تحويل بين المصدرين)
  if (body.youtubeUrl !== undefined) {
    const src = decodeSource(vid.provider_video_id);
    if (src.kind !== "youtube") {
      return NextResponse.json({ ok: false, error: "not_youtube" }, { status: 400 });
    }
    const youtubeId = parseYoutubeId(String(body.youtubeUrl ?? ""));
    if (!youtubeId) return NextResponse.json({ ok: false, error: "bad_youtube_url" }, { status: 400 });
    patch.provider_video_id = encodeYoutube(youtubeId);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const { data: updated, error } = await admin.from("videos")
    .update(patch).eq("id", params.id).eq("tenant_id", urow.tenant_id)
    .select("id,title,visibility,group_ids,provider_video_id,created_at").single();
  if (error || !updated) {
    return NextResponse.json({ ok: false, error: error?.message ?? "update_failed" }, { status: 500 });
  }

  const outSrc = decodeSource((updated as any).provider_video_id);
  return NextResponse.json({
    ok: true,
    video: {
      id: (updated as any).id, title: (updated as any).title,
      visibility: (updated as any).visibility, group_ids: (updated as any).group_ids,
      created_at: (updated as any).created_at,
      source: outSrc.kind,
      youtubeId: outSrc.kind === "youtube" ? outSrc.youtubeId : null,
    },
  });
}

/** DELETE /api/videos/[id] — حذف الفيديو (سجل القاعدة + كائن Bunny، والثاني best-effort) */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const admin = SUPA_URL ? createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null;
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const { data: urow } = await admin.from("users").select("tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  if ((urow as any).role !== "teacher_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(admin, urow.tenant_id, (urow as any).role);
  if (_sw) return _sw;

  const { data: vid } = await admin.from("videos")
    .select("id,provider_video_id")
    .eq("id", params.id).eq("tenant_id", urow.tenant_id).single();
  if (!vid) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const src = decodeSource(vid.provider_video_id);
  if (src.kind === "bunny") {
    // حذف كائن Bunny أولاً (best-effort) — ثم سجل القاعدة مضمون الحذف
    await deleteBunnyVideo(src.guid);
  }

  const { error } = await admin.from("videos").delete().eq("id", params.id).eq("tenant_id", urow.tenant_id);
  if (error) {
    return dbFail("video-delete", error, "delete_failed");
  }
  return NextResponse.json({ ok: true, deleted: params.id });
}
