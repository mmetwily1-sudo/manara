import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
  const { searchParams } = new globalThis.URL(req.url);
  const subject = searchParams.get("subject");
  const difficulty = searchParams.get("difficulty");
  const qtype = searchParams.get("qtype");

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: true, questions: [], demo: true });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: true, questions: [], demo: true });

  let q = admin.from("questions").select("id,subject,lesson,difficulty,qtype,body,options,marks,usage_count").eq("tenant_id", urow.tenant_id).order("created_at", { ascending: false }).limit(100);
  if (subject) q = q.eq("subject", subject);
  if (difficulty) q = q.eq("difficulty", Number(difficulty));
  if (qtype) q = q.eq("qtype", qtype);
  const { data } = await q;
  return NextResponse.json({ ok: true, questions: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  if (!body?.body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const { data, error } = await admin.from("questions").insert({
    tenant_id: urow.tenant_id, subject: body.subject ?? "عام", lesson: body.lesson ?? null,
    difficulty: Number(body.difficulty ?? 2), qtype: body.qtype ?? "mcq",
    body: body.body, options: body.options ?? null, correct_answer: body.correct_answer ?? null,
    marks: Number(body.marks ?? 1),
  }).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}


