import { NextResponse } from "next/server";
import { logError } from "@/lib/api-error";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { TUS_ENDPOINT, isBunnyLive, signTusUpload } from "@/lib/bunny";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
}

/**
 * POST /api/videos/upload-auth
 * وضعان:
 * - جديد: {title, visibility?, groupIds?} → ينشئ سجل الفيديو + يرجع بيانات الرفع (tus) الموقعة.
 * - استبدال: {replaceVideoId} → يتحقق من الملكية وأن المصدر bunny، ثم يرجع توقيعاً لـ GUID جديد
 *   دون إنشاء سجل جديد (التبديل يتم في /complete بعد التحقق).
 * الملف يُرفع من متصفح المعلم إلى Bunny مباشرة — لا يمر عبر سيرفرنا إطلاقاً
 * (مهم: Vercel يحد حجم الطلبات، فالتمرير عبره مستحيل للفيديو).
 */
export async function POST(req: Request) {
  const { title, visibility, groupIds, replaceVideoId } = await req.json().catch(() => ({} as any));
  const isReplace = typeof replaceVideoId === "string" && replaceVideoId.length > 0;
  if (!isReplace && (!title || String(title).trim().length < 2)) {
    return NextResponse.json({ ok: false, error: "title" }, { status: 400 });
  }
  if (!isBunnyLive()) {
    return NextResponse.json(
      { ok: false, error: "bunny_not_configured", message: "الرفع المباشر غير مفعّل — استخدم رابط يوتيوب أو تواصل مع الإدارة" },
      { status: 503 }
    );
  }

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  if ((urow as any).role !== "teacher_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(admin, urow.tenant_id, (urow as any).role);
  if (_sw) return _sw;

  // وضع الاستبدال: تحقق من الفيديو الحالي (ملكية + مصدر bunny) دون إنشاء سجل
  if (isReplace) {
    const { decodeSource } = await import("@/lib/video-source");
    const { data: existing } = await admin.from("videos")
      .select("id,provider_video_id")
      .eq("id", replaceVideoId).eq("tenant_id", urow.tenant_id).single();
    if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const src = decodeSource((existing as any).provider_video_id);
    if (src.kind !== "bunny") {
      return NextResponse.json({ ok: false, error: "not_bunny", message: "استبدال الملف متاح لفيديوهات الرفع المباشر فقط" }, { status: 400 });
    }
  }

  // 1) إنشاء كائن الفيديو في Bunny أولاً للحصول على GUID
  let guid: string;
  try {
    const bv = await (await import("@/lib/bunny")).createBunnyVideo(isReplace ? "replacement" : String(title).trim());
    guid = bv.guid;
  } catch (e: any) {
    logError("bunny-create", e);
    return NextResponse.json({ ok: false, error: "bunny_create_failed" }, { status: 502 });
  }

  let videoId: string;
  if (isReplace) {
    // لا سجل جديد — التبديل يتم في /complete بعد التحقق من وصول الملف
    videoId = replaceVideoId as string;
  } else {
    // 2) سجل قاعدة البيانات (بحالة uploading ضمنياً — لا عمود حالة، والتحقق يتم عند الاكتمال)
    const { data: row, error } = await admin.from("videos").insert({
      tenant_id: urow.tenant_id, title: String(title).trim(), provider_video_id: guid,
      visibility: visibility ?? "group", group_ids: groupIds ?? [],
    }).select("id,provider_video_id").single();
    if (error || !row) {
      return NextResponse.json({ ok: false, error: error?.message ?? "db_failed" }, { status: 500 });
    }
    videoId = row.id;
  }

  // 3) توقيع الرفع (صالح لساعة — المفتاح السري لا يغادر السيرفر أبداً)
  const sig = signTusUpload(guid);
  if (!sig) {
    if (!isReplace) await admin.from("videos").delete().eq("id", videoId);
    return NextResponse.json({ ok: false, error: "bunny_not_configured" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    videoId,
    replace: isReplace,
    tusEndpoint: TUS_ENDPOINT,
    libraryId: sig.libraryId,
    videoGuid: guid,
    authSignature: sig.signature,
    authExpire: sig.expires,
  });
}
