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

/** POST /api/exams/generate â€” ØªÙˆÙ„ÙŠØ¯ Ø§ØªØ­Ø§Ù† Ø¨Ø¶ØºØ·Ø©: ØªÙˆØ²ÙŠØ¹ Ø­Ø³Ø¨ Ø§Ù„ØµØ¹ÙˆØ¨Ø© */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  const { groupId, title, distribution, duration, totalMarks } = body ?? {};
  if (!title || !distribution) return NextResponse.json({ ok: false, error: "title+distribution required" }, { status: 400 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  // Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø§ØªØ­Ø§Ù†
  const { data: exam, error: eErr } = await admin.from("exams").insert({
    tenant_id: urow.tenant_id, group_id: groupId ?? null, title: title.trim(),
    duration_minutes: Number(duration ?? 30), total_marks: Number(totalMarks ?? 0),
  }).select("id").single();
  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

  // Ù„ÙƒÙ„ Ø³ØªÙˆÙ‰: Ø¹ÙŠÙ†Ø© Ø¹Ø´ÙˆØ§Ø¦ÙŠØ©
  for (const [diffStr, count] of Object.entries(distribution as Record<string, number>)) {
    const diff = Number(diffStr); const n = Number(count);
    if (!n) continue;
    const { data: pool } = await admin.from("questions").select("id").eq("tenant_id", urow.tenant_id).eq("difficulty", diff).limit(200);
    if (!pool?.length) continue;
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(n, pool.length));
    for (let i = 0; i < shuffled.length; i++) {
      await admin.from("exam_questions").insert({ exam_id: exam.id, question_id: shuffled[i].id, tenant_id: urow.tenant_id, position: i });
    }
  }

  return NextResponse.json({ ok: true, examId: exam.id });
}


