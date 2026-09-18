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

/** GET /api/exams/[id] — بيانات الامتحان وأسئلته (بدون الإجابات الصحيحة)، وخيارات مخلوطة لكل طالب */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const sb = admin();

  // الامتحان نفسه (البحث بالمعرف أولاً)
  const { data: exam } = await sb
    .from("exams")
    .select("id,tenant_id,title,duration_minutes,total_marks,is_published")
    .eq("id", params.id)
    .single();
  if (!exam) return NextResponse.json({ ok: false, error: "exam_not_found" }, { status: 404 });

  // صلاحية: يجب أن ينتمي المستخدم لنفس السنتر (أو يُسجَّل تلقائياً عند التسليم)
  const { data: urow } = await sb.from("users").select("tenant_id,role").eq("auth_user_id", user.id).single();
  if (urow && urow.tenant_id !== exam.tenant_id) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  // الطالب لا يرى أسئلة امتحان غير منشور (المعلم يستعرض بحرية)
  if (!urow && !(exam as any).is_published) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (urow && (urow as any).role !== "teacher_admin" && !(exam as any).is_published) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: eqs } = await sb
    .from("exam_questions")
    .select("position,marks,questions(id,body,options,qtype,marks,media_url)")
    .eq("exam_id", params.id)
    .eq("tenant_id", exam.tenant_id)
    .order("position", { ascending: true });

  // خلط الخيارات لكل طالب (عدالة بين الطلاب)
  const seed = [...user.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const questions = (eqs ?? []).map((row: any, i: number) => {
    const q = row.questions;
    let options: string[] | null = Array.isArray(q.options) ? [...q.options] : null;
    if (options) {
      const shift = (seed + i) % options.length;
      options = options.slice(shift).concat(options.slice(0, shift));
    }
    return { id: q.id, body: q.body, options, qtype: q.qtype, marks: row.marks ?? q.marks, media_url: q.media_url ?? null };
  });

  return NextResponse.json({
    ok: true,
    exam: { id: exam.id, title: exam.title, duration_minutes: exam.duration_minutes },
    questions,
  });
}

/** DELETE /api/exams/[id] — حذف الامتحان وروابطه ومحاولاته وشهاداتها (معلم فقط) */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const urow = { tenant_id: res.ctx.tenantId };

  const { data: exam } = await sb.from("exams").select("id").eq("id", params.id).eq("tenant_id", urow.tenant_id).single();
  if (!exam) return NextResponse.json({ ok: false, error: "exam_not_found" }, { status: 404 });

  // الشهادات أولاً (لا يوجد cascade عليها)، ثم الامتحان (الباقي cascade تلقائياً)
  const { data: attempts } = await sb.from("exam_attempts").select("id").eq("exam_id", params.id);
  const attemptIds = (attempts ?? []).map((a: any) => a.id);
  if (attemptIds.length) {
    await sb.from("certificates").delete().in("attempt_id", attemptIds);
  }
  const { error } = await sb.from("exams").delete().eq("id", params.id).eq("tenant_id", urow.tenant_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removedAttempts: attemptIds.length });
}
