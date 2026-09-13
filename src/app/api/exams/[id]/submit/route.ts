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

/** POST /api/exams/[id]/submit â€” ØªØ³Ù„ÙŠ Ø¥Ø¬Ø§Ø¨Ø§Øª + ØªØµØ­ÙŠØ­ Ø¢Ù„ÙŠ Ù„Ù€ mcq/true_false */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { answers, tabSwitches } = await req.json().catch(() => ({} as any));
  if (!answers) return NextResponse.json({ ok: false, error: "answers required" }, { status: 400 });

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  // Ø¬Ù„Ø¨ Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø§ØªØ­Ø§Ù† Ø¨Ø¥Ø¬Ø§Ø¨Ø§ØªÙ‡Ø§ Ø§Ù„ØµØ­ÙŠØ­Ø©
  const { data: eqs } = await admin.from("exam_questions").select("question_id,questions(correct_answer,qtype,marks)").eq("exam_id", params.id).eq("tenant_id", urow.tenant_id);
  if (!eqs?.length) return NextResponse.json({ ok: false, error: "no_questions" }, { status: 404 });

  let score = 0;
  for (const row of eqs as any[]) {
    const q = row.questions;
    const ans = answers[row.question_id];
    if (ans == null) continue;
    const correct = q.correct_answer;
    // Ø·Ø§Ø¨Ù‚Ø© Ø±Ù†Ø©: mcq/true_false
    const norm = (v: any) => String(v).trim().toLowerCase();
    if (q.qtype === "mcq" || q.qtype === "true_false") {
      if (norm(ans) === norm(correct)) score += Number(q.marks ?? 1);
    }
  }

  // Ø­ÙØ¸ Ø§Ù„Ø­Ø§ÙˆÙ„Ø©
  const { data: att } = await admin.from("exam_attempts").upsert({
    tenant_id: urow.tenant_id, exam_id: params.id, student_id: urow.id,
    answers, score, submitted_at: new Date().toISOString(), tab_switches: tabSwitches ?? 0,
  }, { onConflict: "exam_id,student_id" }).select("id").single();

  // Ø´Ù‡Ø§Ø¯Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠØ© Ù„Ùˆ â‰¥ 60% (Ù†ÙØ³ Ù†Ø·Ù‚ skill certificates-generator)
  let certSerial: string | null = null;
  const total = (eqs as any[]).reduce((s, r) => s + Number(r.questions.marks ?? 1), 0);
  if (total > 0 && score / total >= 0.6 && att) {
    const { data: cert } = await admin.from("certificates").insert({
      tenant_id: urow.tenant_id, student_id: urow.id, attempt_id: att.id, title: `Ø¥ØªØ§ Ø§ØªØ­Ø§Ù†`, score,
    }).select("serial_code").single();
    certSerial = cert?.serial_code ?? null;
  }

  return NextResponse.json({ ok: true, score, total, certSerial });
}

