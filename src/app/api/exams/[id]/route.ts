import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";
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
    .select("id,tenant_id,title,duration_minutes,total_marks,is_published,require_code")
    .eq("id", params.id)
    .single();
  if (!exam) return NextResponse.json({ ok: false, error: "exam_not_found" }, { status: 404 });

  // صلاحية: يجب أن ينتمي المستخدم لنفس السنتر (أو يُسجَّل تلقائياً عند التسليم)
  const { data: urow } = await sb.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
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
  // بوابة الكود: الطالب يحتاج جلسة مفعّلة سارية (المعلم يستعرض بحرية)
  if ((exam as any).require_code && urow && (urow as any).role !== "teacher_admin") {
    const { data: sess } = await sb.from("exam_codes").select("id,expires_at")
      .eq("exam_id", params.id).eq("student_id", (urow as any).id).eq("status", "started").single();
    if (!sess || ((sess as any).expires_at && new Date((sess as any).expires_at) < new Date())) {
      return NextResponse.json({ ok: false, error: "code_required" }, { status: 403 });
    }
  }

  const { data: eqs } = await sb
    .from("exam_questions")
    .select("position,marks,questions(id,body,options,qtype,marks,media_url)")
    .eq("exam_id", params.id)
    .eq("tenant_id", exam.tenant_id)
    .order("position", { ascending: true });

  // خلط الخيارات + ترتيب الأسئلة لكل طالب (حتمي لكل طالب — ثابت عند التحديث)
  const seed = [...user.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  let h = seed >>> 0;
  const rnd = () => {
    h |= 0; h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const questions = (eqs ?? []).map((row: any, i: number) => {
    const q = row.questions;
    let options: string[] | null = Array.isArray(q.options) ? [...q.options] : null;
    if (options) {
      const shift = (seed + i) % options.length;
      options = options.slice(shift).concat(options.slice(0, shift));
    }
    return { id: q.id, body: q.body, options, qtype: q.qtype, marks: row.marks ?? q.marks, media_url: q.media_url ?? null };
  });
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return NextResponse.json({
    ok: true,
    exam: { id: exam.id, title: exam.title, duration_minutes: exam.duration_minutes },
    questions,
  });
}

/** PATCH /api/exams/[id] — تعديل العنوان/المدة/النشر (معلم فقط، سنتره فقط) */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;

  const body = await req.json().catch(() => ({} as any));
  const patch: Record<string, unknown> = {};
  if (typeof body.is_published === "boolean") patch.is_published = body.is_published;
  if (typeof body.title === "string" && body.title.trim().length >= 2) patch.title = body.title.trim().slice(0, 120);
  if (typeof body.duration_minutes === "number" && body.duration_minutes >= 1 && body.duration_minutes <= 180) {
    patch.duration_minutes = Math.floor(body.duration_minutes);
  }
  if (typeof body.require_code === "boolean") patch.require_code = body.require_code;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });

  const { data: exam } = await admin.from("exams").select("id").eq("id", params.id).eq("tenant_id", res.ctx.tenantId).single();
  if (!exam) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { error } = await admin.from("exams").update(patch).eq("id", params.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("exam", error);
  return NextResponse.json({ ok: true, updated: patch });
}

/** DELETE /api/exams/[id] — حذف الامتحان وروابطه ومحاولاته وشهاداتها (معلم فقط) */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
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
  if (error) return dbFail("exam", error);
  return NextResponse.json({ ok: true, removedAttempts: attemptIds.length });
}
