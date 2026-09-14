import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getBunnyVideoStatus, isBunnyLive } from "@/lib/bunny";

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
 * POST /api/videos/complete { videoId }
 * يُستدعى بعد انتهاء رفع tus من المتصفح.
 * يتحقق من وجود الفيديو فعلياً في مكتبة Bunny قبل اعتماده (لا نثق بإدعاء العميل وحده).
 */
export async function POST(req: Request) {
  const { videoId } = await req.json().catch(() => ({} as any));
  if (!videoId) return NextResponse.json({ ok: false, error: "videoId" }, { status: 400 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const { data: vid } = await admin.from("videos")
    .select("id,provider_video_id,title")
    .eq("id", videoId).eq("tenant_id", urow.tenant_id).single();
  if (!vid) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (!isBunnyLive()) return NextResponse.json({ ok: true, video: { id: vid.id }, verified: false });

  try {
    const st = await getBunnyVideoStatus(vid.provider_video_id);
    if (!st?.ok) {
      await admin.from("videos").delete().eq("id", vid.id);
      return NextResponse.json({ ok: false, error: "upload_not_found", message: "لم يصل الملف إلى Bunny — حاول الرفع مجدداً" }, { status: 400 });
    }
    if (st.status === 5) {
      await admin.from("videos").delete().eq("id", vid.id);
      return NextResponse.json({ ok: false, error: "upload_failed", message: "فشل الرفع في Bunny — حاول مجدداً" }, { status: 400 });
    }
    // status 0..4,6 = الملف موجود (قد يكون قيد التحويل — المشغل يعرضه تدريجياً)
    return NextResponse.json({ ok: true, video: { id: vid.id }, verified: true, bunnyStatus: st.statusText });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "verify_failed", details: String(e?.message ?? e).slice(0, 200) }, { status: 502 });
  }
}
