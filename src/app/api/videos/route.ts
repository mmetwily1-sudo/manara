import { NextResponse } from "next/server";
import { createBunnyVideo } from "@/lib/bunny";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
}

export async function POST(req: Request) {
  const { title, visibility, groupIds } = await req.json().catch(() => ({} as any));
  if (!title || title.trim().length < 2) return NextResponse.json({ ok: false, error: "title" }, { status: 400 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const bv = await createBunnyVideo(title.trim());

  const { data: row, error } = await admin.from("videos").insert({
    tenant_id: urow.tenant_id, title: bv.title, provider_video_id: bv.guid,
    visibility: visibility ?? "group", group_ids: groupIds ?? [],
  }).select("id,provider_video_id").single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, video: row });
}


