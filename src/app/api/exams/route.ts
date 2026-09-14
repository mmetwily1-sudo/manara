import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, { cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } } });
}

function admin() {
  return createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** GET /api/exams — قائمة امتحانات سنتر المستخدم الحالي */
export async function GET() {
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const sb = admin();
  const { data: urow } = await sb.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const { data: exams } = await sb
    .from("exams")
    .select("id,title,duration_minutes,total_marks,is_published,created_at")
    .eq("tenant_id", urow.tenant_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (exams ?? []).map((e: any) => e.id);
  let qCounts: Record<string, number> = {};
  let aCounts: Record<string, number> = {};
  if (ids.length) {
    const [{ data: links }, { data: attempts }] = await Promise.all([
      sb.from("exam_questions").select("exam_id").in("exam_id", ids),
      sb.from("exam_attempts").select("exam_id").in("exam_id", ids),
    ]);
    for (const l of (links ?? []) as any[]) qCounts[l.exam_id] = (qCounts[l.exam_id] ?? 0) + 1;
    for (const a of (attempts ?? []) as any[]) aCounts[a.exam_id] = (aCounts[a.exam_id] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    exams: (exams ?? []).map((e: any) => ({
      ...e,
      questions_count: qCounts[e.id] ?? 0,
      attempts_count: aCounts[e.id] ?? 0,
    })),
  });
}
