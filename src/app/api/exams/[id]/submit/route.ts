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
    .select("id,tenant_id,title,is_published,require_code,duration_minutes")
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
  {
    const { data: sus } = await sb.from("users").select("suspended_until").eq("id", urow.id).single();
    if ((sus as any)?.suspended_until && String((sus as any).suspended_until) >= new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ ok: false, error: "suspended" }, { status: 403 });
    }
  }

  // 2.5) بوابة الكود: جلسة سارية + مؤقت السيرفر (لا يُعتمد على مؤقت المتصفح)
  let codeRow: any = null;
  if ((exam as any).require_code) {
    const { data: sess } = await sb.from("exam_codes").select("*")
      .eq("exam_id", params.id).eq("student_id", urow.id).eq("status", "started").single();
    if (!sess) return NextResponse.json({ ok: false, error: "code_required" }, { status: 403 });
    if ((sess as any).expires_at && new Date((sess as any).expires_at) < new Date()) {
      await sb.from("exam_codes").update({ status: "expired" }).eq("id", (sess as any).id);
      return NextResponse.json({ ok: false, error: "expired" }, { status: 410 });
    }
    codeRow = sess;
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

  // 5) حفظ المحاولة (+10 نقاط لأول تسليم لكل امتحان)
  const { data: prevAtt } = await sb.from("exam_attempts").select("id")
    .eq("exam_id", params.id).eq("student_id", urow.id).single();
  const { data: att, error: attErr } = await sb.from("exam_attempts").upsert({
    tenant_id: exam.tenant_id, exam_id: params.id, student_id: urow.id,
    answers, score, submitted_at: new Date().toISOString(), tab_switches: tabSwitches ?? 0,
  }, { onConflict: "exam_id,student_id" }).select("id").single();
  if (attErr || !att) {
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
  if (codeRow) {
    // استهلاك الكود لمرة واحدة (يمنع إعادة الاستخدام — Replay)
    await sb.from("exam_codes").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", codeRow.id);
  }
  if (!prevAtt) {
    const { awardPoints, POINTS } = await import("@/lib/gamification");
    await awardPoints(sb, exam.tenant_id, urow.id, POINTS.examAttempt);
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

  // إشعار واتساب بالنتيجة (best-effort)
  try {
    const { notifyStudent } = await import("@/lib/notify");
    await notifyStudent(sb, {
      tenantId: exam.tenant_id,
      studentId: urow.id,
      event: { kind: "exam_graded", studentName: "", examTitle: exam.title, score, total, certSerial },
      dedupeKey: `exam:${att.id}`,
    });
  } catch {}

  // تنبيه فوري للمدرس عند إشارات قوية (v2 — إرشادي لا حظر)
  try {
    const { data: tm } = await sb.from("exam_attempts").select("started_at").eq("id", att.id).single();
    const durMin = (tm as any)?.started_at
      ? (Date.now() - new Date((tm as any).started_at).getTime()) / 60000 : null;
    const allotted = Math.max(1, Number((exam as any).duration_minutes ?? 30));
    const fastPerfect = durMin !== null && durMin < allotted * 0.1 && total > 0 && score / total >= 0.9;
    const manyTabs = Number(tabSwitches ?? 0) > 5;
    if (fastPerfect || manyTabs) {
      const { data: stu } = await sb.from("users").select("full_name").eq("id", urow.id).single();
      const why = [
        fastPerfect ? `حل سريع (${durMin!.toFixed(1)} د من ${allotted}) بدرجة ${score}/${total}` : "",
        manyTabs ? `${tabSwitches} تبديل تبويب` : "",
      ].filter(Boolean).join(" + ");
      await sb.from("audit_log").insert({
        tenant_id: exam.tenant_id, actor_id: urow.id,
        action: "exam:suspicion_instant", entity_type: "exam", entity_id: params.id,
        details: { student: (stu as any)?.full_name ?? "", why },
      });
      const { data: teachers } = await sb.from("users").select("id")
        .eq("tenant_id", exam.tenant_id).in("role", ["teacher_admin", "supervisor"]).limit(10);
      const { sendPushToUser } = await import("@/lib/push");
      for (const tch of (teachers ?? []) as any[]) {
        await sendPushToUser(sb, exam.tenant_id, tch.id, {
          title: "🕵️ مؤشر اشتباه فوري",
          body: `${(stu as any)?.full_name ?? "طالب"} — ${exam.title}: ${why}`,
          url: "/dashboard/exams",
        });
      }
    }
  } catch {}

  return NextResponse.json({ ok: true, score, total, certSerial });
}
