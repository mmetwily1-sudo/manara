import { NextResponse } from "next/server";
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
 * ينشئ سجل الفيديو + يرجع بيانات الرفع المباشر (tus) الموقعة.
 * الملف يُرفع من متصفح المعلم إلى Bunny مباشرة — لا يمر عبر سيرفرنا إطلاقاً
 * (مهم: Vercel يحد حجم الطلبات، فالتمرير عبره مستحيل للفيديو).
 */
export async function POST(req: Request) {
  const { title, visibility, groupIds } = await req.json().catch(() => ({} as any));
  if (!title || String(title).trim().length < 2) {
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
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  // 1) إنشاء كائن الفيديو في Bunny أولاً للحصول على GUID
  let guid: string;
  try {
    const bv = await (await import("@/lib/bunny")).createBunnyVideo(String(title).trim());
    guid = bv.guid;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "bunny_create_failed", details: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }

  // 2) سجل قاعدة البيانات (بحالة uploading ضمنياً — لا عمود حالة، والتحقق يتم عند الاكتمال)
  const { data: row, error } = await admin.from("videos").insert({
    tenant_id: urow.tenant_id, title: String(title).trim(), provider_video_id: guid,
    visibility: visibility ?? "group", group_ids: groupIds ?? [],
  }).select("id,provider_video_id").single();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: error?.message ?? "db_failed" }, { status: 500 });
  }

  // 3) توقيع الرفع (صالح لساعة — المفتاح السري لا يغادر السيرفر أبداً)
  const sig = signTusUpload(guid);
  if (!sig) {
    await admin.from("videos").delete().eq("id", row.id);
    return NextResponse.json({ ok: false, error: "bunny_not_configured" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    videoId: row.id,
    tusEndpoint: TUS_ENDPOINT,
    libraryId: sig.libraryId,
    videoGuid: guid,
    authSignature: sig.signature,
    authExpire: sig.expires,
  });
}
