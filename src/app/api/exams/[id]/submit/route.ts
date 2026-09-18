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

function norm(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

/** POST /api/exams/[id]/submit — تسليم إجابات + تصحيح آلي */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { answers, tabSwitches } = await req.json().catch(() => ({} as any));
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ ok: false, error: "answers_required" }, { status: 400 });
  }

  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const sb = admin();

  // 1) الامتحان أولاً — هو مصدر الحقيقة للسنتر
  const { data: exam } = await sb
    .from("exams")
    .select("id,tenant_id,title,is_published")
    .eq("id", params.id)
    .single();
  if (!exam) return NextResponse.json({ ok: false, error: "exam_not_found" }, { status: 404 });

  // 2) صف المستخدم — وإن غاب يُنشأ تلقائياً كطالب في سنتر الامتحان
  // (فقط للامتحانات المنشورة — وإلا فالتسجيل التلقائي ثغرة cross-tenant)
  let { data: urow } = await sb.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow && !(exam as any).is_published) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!urow) {
    const meta = (user.user_metadata ?? {}) as any;
    const { data: created, error: cErr } = await sb.from("users").insert({
      tenant_id: exam.tenant_id,
      auth_user_id: user.id,
      role: "student",
      full_name: meta.full_name ?? user.email?.split("@")[0] ?? "طالب",
      phone: meta.phone ?? null,
    }).select("id,tenant_id,role").single();
    if (cErr || !created) {
      return NextResponse.json({ ok: false, error: "enroll_failed" }, { status: 500 });
    }
    urow = created;
  }
  if (urow.tenant_id !== exam.tenant_id) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // 3) أسئلة الامتحان بإجاباتها الصحيحة
  const { data: eqs } = await sb
    .from("exam_questions")
    .select("question_id,marks,questions(correct_answer,qtype,marks)")
    .eq("exam_id", params.id)
    .eq("tenant_id", exam.tenant_id);
  if (!eqs?.length) return NextResponse.json({ ok: false, error: "no_questions" }, { status: 404 });

  // 4) التصحيح الآلي
  let score = 0;
  for (const row of eqs as any[]) {
    const q = row.questions;
    const ans = answers[row.question_id];
    if (ans == null || ans === "") continue;
    if (q.qtype === "mcq" || q.qtype === "true_false" || q.qtype === "short_answer") {
      if (norm(ans) === norm(q.correct_answer)) score += Number(row.marks ?? q.marks ?? 1);
    }
  }

  // 5) حفظ المحاولة
  const { data: att, error: attErr } = await sb.from("exam_attempts").upsert({
    tenant_id: exam.tenant_id, exam_id: params.id, student_id: urow.id,
    answers, score, submitted_at: new Date().toISOString(), tab_switches: tabSwitches ?? 0,
  }, { onConflict: "exam_id,student_id" }).select("id").single();
  if (attErr || !att) {
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }

  // 6) شهادة تلقائية عند ≥ 60%
  let certSerial: string | null = null;
  const total = (eqs as any[]).reduce((s, r) => s + Number(r.marks ?? r.questions?.marks ?? 1), 0);
  if (total > 0 && score / total >= 0.6) {
    const { data: existing } = await sb.from("certificates").select("serial_code").eq("attempt_id", att.id).single();
    if (existing) {
      certSerial = existing.serial_code;
    } else {
      const { data: cert } = await sb.from("certificates").insert({
        tenant_id: exam.tenant_id, student_id: urow.id, attempt_id: att.id,
        title: `إتمام: ${exam.title}`, score,
      }).select("serial_code").single();
      certSerial = cert?.serial_code ?? null;
    }
  }

  return NextResponse.json({ ok: true, score, total, certSerial });
}
