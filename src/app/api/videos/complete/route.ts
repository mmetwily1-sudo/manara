import { NextResponse } from "next/server";
import { logError } from "@/lib/api-error";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { deleteBunnyVideo, getBunnyVideoStatus, isBunnyLive } from "@/lib/bunny";

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
 * POST /api/videos/complete { videoId, newProviderId? }
 * يُستدعى بعد انتهاء رفع tus من المتصفح.
 * يتحقق من وجود الفيديو فعلياً في مكتبة Bunny قبل اعتماده (لا نثق بإدعاء العميل وحده).
 * وضع الاستبدال: newProviderId = الـ GUID الجديد → يتحقق منه، يبدّل السجل، ويحذف القديم.
 */
export async function POST(req: Request) {
  const { videoId, newProviderId } = await req.json().catch(() => ({} as any));
  if (!videoId) return NextResponse.json({ ok: false, error: "videoId" }, { status: 400 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  if ((urow as any).role !== "teacher_admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { data: vid } = await admin.from("videos")
    .select("id,provider_video_id,title")
    .eq("id", videoId).eq("tenant_id", urow.tenant_id).single();
  if (!vid) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (!isBunnyLive()) return NextResponse.json({ ok: true, video: { id: vid.id }, verified: false });

  // وضع الاستبدال: تحقق من الجديد أولاً، ثم بدّل، ثم احذف القديم (ترتيب آمن ضد الفقد)
  if (typeof newProviderId === "string" && newProviderId.length > 0) {
    const { decodeSource } = await import("@/lib/video-source");
    const cur = decodeSource(vid.provider_video_id);
    if (cur.kind !== "bunny") {
      return NextResponse.json({ ok: false, error: "not_bunny" }, { status: 400 });
    }
    try {
      const st = await getBunnyVideoStatus(newProviderId);
      if (!st?.ok) {
        await deleteBunnyVideo(newProviderId);
        return NextResponse.json({ ok: false, error: "upload_not_found", message: "لم يصل الملف الجديد إلى Bunny — حاول الرفع مجدداً" }, { status: 400 });
      }
      if (st.status === 5) {
        await deleteBunnyVideo(newProviderId);
        return NextResponse.json({ ok: false, error: "upload_failed", message: "فشل الرفع الجديد في Bunny — حاول مجدداً" }, { status: 400 });
      }
      const { error: upErr } = await admin.from("videos")
        .update({ provider_video_id: newProviderId })
        .eq("id", vid.id).eq("tenant_id", urow.tenant_id);
      if (upErr) {
        await deleteBunnyVideo(newProviderId);
        return NextResponse.json({ ok: false, error: upErr.message ?? "swap_failed" }, { status: 500 });
      }
      // القديم يُحذف بعد نجاح التبديل — best-effort (فشله لا يفشل الطلب)
      const oldDeleted = await deleteBunnyVideo(cur.guid);
      return NextResponse.json({ ok: true, video: { id: vid.id }, verified: true, replaced: true, oldDeleted });
    } catch (e: any) {
      await deleteBunnyVideo(newProviderId);
      logError("bunny-verify", e);
      return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 502 });
    }
  }

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
    logError("bunny-verify", e);
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 502 });
  }
}
