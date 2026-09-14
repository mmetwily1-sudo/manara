import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getDemoHlsUrl, signPlaybackUrl, isBunnyLive } from "@/lib/bunny";
import { decodeSource, youtubeEmbedUrl } from "@/lib/video-source";

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

  if (admin) {
    const sbUser = supaUser();
    const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
    if (user) {
      const { data: vid } = await admin.from("videos").select("title,provider_video_id,visibility,group_ids,excluded_student_ids").eq("id", params.id).single();
      if (vid?.provider_video_id) {
        const sid = user.id;
        const excluded = (vid.excluded_student_ids as string[] | null) ?? [];
        if (excluded.includes(sid)) return NextResponse.json({ ok: false, error: "excluded" }, { status: 403 });
        const src = decodeSource(vid.provider_video_id);
        if (src.kind === "youtube") {
          return NextResponse.json({ ok: true, source: "youtube", youtubeId: src.youtubeId, embedUrl: youtubeEmbedUrl(src.youtubeId), title: (vid as any).title });
        }
        if (src.kind === "bunny") {
          const hls = isBunnyLive() ? signPlaybackUrl(src.guid, sid) : getDemoHlsUrl();
          return NextResponse.json({ ok: true, source: "bunny", hls, live: isBunnyLive() });
        }
        return NextResponse.json({ ok: false, error: "bad_source" }, { status: 422 });
      }
    }
  }
  return NextResponse.json({ ok: true, hls: getDemoHlsUrl(), live: false });
}
