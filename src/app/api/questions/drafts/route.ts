import { NextResponse } from "next/server";

function pageUrl(tenantId: string, ref: string, page: number): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base || !ref) return null;
  return `${base}/storage/v1/object/public/exam-pages/scans/${tenantId}/${ref}/p${String(page).padStart(3, "0")}.png`;
}

function metaOf(row: any): { ref: string | null; page: number | null; exam_id: string | null } {
  try {
    const m = JSON.parse(row.source_detail ?? "{}");
    return { ref: m.ref ?? null, page: m.page ?? null, exam_id: m.exam_id ?? null };
  } catch {
    return { ref: null, page: null, exam_id: null };
  }
}

/** GET /api/questions/drafts — مسودات المعلم الخاصة (مع صورها) */
export async function GET() {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { data } = await admin
    .from("questions")
    .select("id,subject,body,options,correct_answer,difficulty,source_detail,created_at")
    .eq("tenant_id", tid)
    .eq("visibility", "private")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(100);

  const examIds = Array.from(new Set(((data ?? []) as any[]).map((d) => metaOf(d).exam_id as string).filter(Boolean)));
  let examTitles: Record<string, string> = {};
  if (examIds.length) {
    const { data: exs } = await admin.from("exams").select("id,title").in("id", examIds as string[]);
    for (const e of (exs ?? []) as any[]) examTitles[e.id] = e.title;
  }

  return NextResponse.json({
    ok: true,
    drafts: ((data ?? []) as any[]).map((d) => {
      const m = metaOf(d);
      return {
        ...d,
        draft_ref: m.ref,
        draft_page: m.page,
        exam_id: m.exam_id,
        exam_title: (m.exam_id && examTitles[m.exam_id]) || null,
        page_url: m.ref && m.page ? pageUrl(tid, m.ref, m.page) : null,
      };
    }),
  });
}

/**
 * POST /api/questions/drafts { id, action: approve|delete, ...edits }
 * approve: يتحقق من الاكتمال، يعتمد، ويربط بالامتحان إن وُجد في المسودة.
 */
export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const body = await req.json().catch(() => ({} as any));
  const { id, action } = body ?? {};
  if (!id || !["approve", "delete"].includes(action)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const { data: d } = await admin
    .from("questions")
    .select("id,options,correct_answer,body,source_detail")
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("status", "draft")
    .single();
  if (!d) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (action === "delete") {
    await admin.from("questions").delete().eq("id", id).eq("tenant_id", tid).eq("status", "draft");
    return NextResponse.json({ ok: true, action });
  }

  const { parseOptions } = await import("@/lib/parse-options");
  const patch: Record<string, unknown> = { status: "approved" };
  if (typeof body.body === "string" && body.body.trim().length >= 2) patch.body = body.body.trim();
  const opts = parseOptions(body.options);
  if (opts.length >= 2) patch.options = opts;
  if (typeof body.correct_answer === "string" && body.correct_answer.trim()) patch.correct_answer = body.correct_answer.trim();
  if (typeof body.lesson_code === "string" && body.lesson_code) patch.lesson_code = body.lesson_code;
  if (typeof body.difficulty === "number" && body.difficulty >= 1 && body.difficulty <= 5) patch.difficulty = body.difficulty;

  const finalOpts = (patch.options ?? (d as any).options) as string[] | null;
  const finalAns = (patch.correct_answer ?? (d as any).correct_answer) as string | null;
  const finalBody = (patch.body ?? (d as any).body) as string;
  if (!finalBody || finalBody.startsWith("[صفحة")) {
    return NextResponse.json({ ok: false, error: "incomplete", message: "انسخ نص السؤال من الصورة أولاً" }, { status: 400 });
  }
  if (!finalOpts?.length || !finalAns) {
    return NextResponse.json({ ok: false, error: "incomplete", message: "المسودة تحتاج اختيارات وإجابة صحيحة" }, { status: 400 });
  }

  const { error } = await admin
    .from("questions")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("status", "draft");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // ربط تلقائي بامتحان المسح إن وُجد
  let linkedExam: string | null = null;
  const examId = metaOf(d).exam_id;
  if (examId) {
    const { data: ex } = await admin.from("exams").select("id").eq("id", examId).eq("tenant_id", tid).single();
    if (ex) {
      const { data: maxPos } = await admin
        .from("exam_questions").select("position").eq("exam_id", examId).order("position", { ascending: false }).limit(1).single();
      const pos = ((maxPos as any)?.position ?? -1) + 1;
      const { error: linkErr } = await admin.from("exam_questions").insert({
        tenant_id: tid, exam_id: examId, question_id: id, position: pos, marks: 1,
      });
      if (!linkErr) {
        linkedExam = examId;
        // حدّث مجموع درجات الامتحان
        const { data: all } = await admin.from("exam_questions").select("marks").eq("exam_id", examId);
        const total = ((all ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 1), 0);
        await admin.from("exams").update({ total_marks: total }).eq("id", examId);
      }
    }
  }
  return NextResponse.json({ ok: true, action, linkedExam });
}
