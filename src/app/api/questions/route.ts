import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isMissingTable } from "@/lib/server-auth";

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

  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const urow = { tenant_id: res.ctx.tenantId };

  const cols = "id,subject,lesson,lesson_code,difficulty,qtype,body,options,marks,usage_count,visibility,status";
  let q = admin.from("questions").select(cols).eq("tenant_id", urow.tenant_id).order("created_at", { ascending: false }).limit(100);
  if (subject) q = q.eq("subject", subject);
  if (difficulty) q = q.eq("difficulty", Number(difficulty));
  if (qtype) q = q.eq("qtype", qtype);
  const { data } = await q;
  // البنك المركزي: أسئلة عامة معتمدة (للقراءة فقط من جهة المعلم)
  let shared: any[] = [];
  try {
    let sq = admin.from("questions").select(cols).is("tenant_id", null).eq("visibility", "shared").eq("status", "approved").order("created_at", { ascending: false }).limit(100);
    if (subject) sq = sq.eq("subject", subject);
    if (difficulty) sq = sq.eq("difficulty", Number(difficulty));
    if (qtype) sq = sq.eq("qtype", qtype);
    const { data: sd } = await sq;
    shared = (sd ?? []).map((r: any) => ({ ...r, shared: true }));
  } catch {}
  const own = (data ?? []).map((r: any) => ({ ...r, shared: false }));
  return NextResponse.json({ ok: true, questions: [...own, ...shared] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  if (!body?.body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
  const { requireTeacher: rt } = await import("@/lib/server-auth");
  const res = await rt(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const urow = { tenant_id: res.ctx.tenantId };

  // ربط المنهج (اختياري): كود درس + كتاب موجود فعلاً
  const lessonCode = typeof body.lesson_code === "string" && body.lesson_code.trim() ? body.lesson_code.trim().slice(0, 40) : null;
  let bookId: string | null = null;
  if (typeof body.book_id === "string" && body.book_id) {
    const { data: bk, error: bkErr } = await admin.from("curriculum_books").select("id").eq("id", body.book_id).single();
    if (isMissingTable(bkErr)) {
      return NextResponse.json({ ok: false, error: "curriculum_not_ready", message: "ربط الكتب يتطلب ترحيل 004" }, { status: 400 });
    }
    if (!bk) return NextResponse.json({ ok: false, error: "bad_book" }, { status: 400 });
    bookId = (bk as any).id;
  }
  const source = bookId ? "book" : ["teacher", "moe", "azhar"].includes(body.source) ? body.source : "teacher";

  const base: any = {
    tenant_id: urow.tenant_id, subject: body.subject ?? "عام", lesson: body.lesson ?? null,
    difficulty: Number(body.difficulty ?? 2), qtype: body.qtype ?? "mcq",
    body: body.body, options: body.options ?? null, correct_answer: body.correct_answer ?? null,
    marks: Number(body.marks ?? 1),
  };
  // مشاركة مع البنك المركزي؟ → تُنشأ بلا ربط عام، وحالة بانتظار المراجعة
  const wantShare = body.share === true;
  const sourceDetail = typeof body.source_detail === "string" ? body.source_detail.trim().slice(0, 200) : null;
  const full: any = {
    ...base, lesson_code: lessonCode, book_id: bookId, source,
    source_detail: sourceDetail,
    visibility: "private", status: wantShare ? "pending" : "approved",
  };
  let { data, error } = await admin.from("questions").insert(full).select("id").single();
  // قبل ترحيل 004/005 (لا أعمدة ربط/مشاركة) — احفظ الأساسي بدل الفشل
  if (error && /lesson_code|book_id|source|visibility|status/.test(error.message ?? "")) {
    const retry = await admin.from("questions").insert(base).select("id").single();
    data = retry.data; error = retry.error;
  }
  if (error) return dbFail("questions", error);
  return NextResponse.json({ ok: true, id: (data as any).id, pending_review: wantShare && !error });
}

/** DELETE /api/questions?id= — حذف سؤال من البنك (معلم فقط) */
export async function DELETE(req: Request) {
  const { requireTeacher: rt } = await import("@/lib/server-auth");
  const res = await rt(["teacher_admin"]);
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  // لا تحذف سؤالاً مستخدماً في امتحان
  const { data: used } = await res.ctx.admin
    .from("exam_questions").select("exam_id").eq("question_id", id).limit(1);
  if (used?.length) {
    return NextResponse.json({ ok: false, error: "in_use", message: "السؤال مستخدم في امتحان — احذفه من الامتحان أولاً" }, { status: 400 });
  }
  const { error } = await res.ctx.admin
    .from("questions").delete().eq("id", id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("questions", error);
  return NextResponse.json({ ok: true });
}


