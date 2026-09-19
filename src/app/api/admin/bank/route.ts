import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server-auth";

async function gate() {
  const res = await requirePlatformAdmin();
  if ("error" in res) return { error: res.error as ReturnType<typeof NextResponse.json> };
  return { ctx: res.ctx };
}

/**
 * GET /api/admin/bank — طابور المراجعة + إحصائيات + فجوات التغطية.
 * الفجوة = درس منهجي بلا أي سؤال عام معتمد (دليل صناعة المحتوى).
 */
export async function GET() {
  const g = await gate();
  if ("error" in g) return g.error;
  const admin = g.ctx!.admin;

  const { data: pending } = await admin
    .from("questions")
    .select("id,subject,lesson,lesson_code,difficulty,qtype,body,options,correct_answer,marks,source,book_id,tenant_id,created_at")
    .eq("visibility", "private")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  const tenantIds = Array.from(new Set((pending ?? []).map((p: any) => p.tenant_id as string).filter(Boolean)));
  let tenantNames: Record<string, string> = {};
  if (tenantIds.length) {
    const { data: ts } = await admin.from("tenants").select("id,name").in("id", tenantIds);
    for (const t of (ts ?? []) as any[]) tenantNames[t.id] = t.name;
  }

  const [{ count: sharedTotal }, { count: pendingCount }] = await Promise.all([
    admin.from("questions").select("id", { count: "exact", head: true }).is("tenant_id", null).eq("visibility", "shared").eq("status", "approved"),
    admin.from("questions").select("id", { count: "exact", head: true }).eq("visibility", "private").eq("status", "pending"),
  ]);

  const { data: perSubject } = await admin
    .from("questions").select("subject")
    .is("tenant_id", null).eq("visibility", "shared").eq("status", "approved")
    .limit(5000);
  const bySubject: Record<string, number> = {};
  for (const r of (perSubject ?? []) as any[]) bySubject[r.subject ?? "عام"] = (bySubject[r.subject ?? "عام"] ?? 0) + 1;

  // الفجوات: دروس بلا أسئلة عامة (عينة أول 200 درس لتخفيف الحمل)
  let gaps: { track: string; subject: string; lesson: string; code: string }[] = [];
  try {
    const { data: lessons } = await admin
      .from("curriculum_lessons").select("track_id,subject,lesson_title,code").limit(1000);
    const { data: covered } = await admin
      .from("questions").select("lesson_code")
      .is("tenant_id", null).eq("visibility", "shared").eq("status", "approved")
      .not("lesson_code", "is", null).limit(5000);
    const coveredSet = new Set((covered ?? []).map((c: any) => c.lesson_code));
    const { data: tracks } = await admin.from("curriculum_tracks").select("id,code");
    const trackCode: Record<string, string> = {};
    for (const t of (tracks ?? []) as any[]) trackCode[t.id] = t.code;
    gaps = ((lessons ?? []) as any[])
      .filter((l) => !coveredSet.has(l.code))
      .slice(0, 100)
      .map((l) => ({ track: trackCode[l.track_id] ?? "", subject: l.subject, lesson: l.lesson_title, code: l.code }));
  } catch {}

  // مسودات PDF (مراجعة جنباً لجنب مع صورة الصفحة)
  const { data: drafts } = await admin
    .from("questions")
    .select("id,subject,body,options,correct_answer,difficulty,source_detail,created_at")
    .is("tenant_id", null)
    .eq("visibility", "shared")
    .eq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(100);
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const draftsOut = ((drafts ?? []) as any[]).map((d) => {
    let meta: any = {};
    try { meta = JSON.parse(d.source_detail ?? "{}"); } catch {}
    return {
      ...d,
      draft_ref: meta.ref ?? null,
      draft_page: meta.page ?? null,
      page_url: meta.ref && meta.page
        ? `${base}/storage/v1/object/public/exam-pages/drafts/${meta.ref}/p${String(meta.page).padStart(3, "0")}.png`
        : null,
    };
  });

  return NextResponse.json({
    ok: true,
    stats: { sharedTotal: sharedTotal ?? 0, pendingCount: pendingCount ?? 0, bySubject, gapsTotal: gaps.length, draftsCount: draftsOut.length },
    pending: (pending ?? []).map((p: any) => ({ ...p, tenant_name: tenantNames[p.tenant_id] ?? "—" })),
    gaps,
    drafts: draftsOut,
  });
}

/**
 * POST /api/admin/bank { id, action: approve|reject|delete_global }
 * approve: نسخ نسخة عامة (الأصل يبقى ملك المعلم) + وسم المراجِع.
 */
export async function POST(req: Request) {
  const g = await gate();
  if ("error" in g) return g.error;
  const admin = g.ctx!.admin;
  const body = await req.json().catch(() => ({} as any));
  const { id, action } = body ?? {};
  if (!id || !["approve", "reject", "delete_global", "approve_draft", "delete_draft"].includes(action)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // مسودات PDF: اعتماد مع تصحيحات المراجع، أو حذف
  if (action === "delete_draft") {
    const { error } = await admin.from("questions").delete().eq("id", id).is("tenant_id", null).eq("status", "draft");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action });
  }
  if (action === "approve_draft") {
    const { parseOptions } = await import("@/lib/parse-options");
    const patch: Record<string, unknown> = { status: "approved", reviewed_by: g.ctx!.adminId, reviewed_at: new Date().toISOString() };
    if (typeof body.body === "string" && body.body.trim().length >= 2) patch.body = body.body.trim();
    const opts = parseOptions(body.options);
    if (opts.length >= 2) patch.options = opts;
    if (typeof body.correct_answer === "string" && body.correct_answer.trim()) patch.correct_answer = body.correct_answer.trim();
    if (typeof body.lesson_code === "string" && body.lesson_code) patch.lesson_code = body.lesson_code;
    if (typeof body.difficulty === "number" && body.difficulty >= 1 && body.difficulty <= 5) patch.difficulty = body.difficulty;
    if (typeof body.subject === "string" && body.subject.trim()) patch.subject = body.subject.trim();
    const { data: dd } = await admin.from("questions").select("id,options,correct_answer,body").eq("id", id).is("tenant_id", null).eq("status", "draft").single();
    if (!dd) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const finalOpts = (patch.options ?? (dd as any).options) as string[] | null;
    const finalAns = (patch.correct_answer ?? (dd as any).correct_answer) as string | null;
    if (!finalOpts?.length || !finalAns) {
      return NextResponse.json({ ok: false, error: "incomplete", message: "المسودة تحتاج اختيارات وإجابة صحيحة قبل الاعتماد" }, { status: 400 });
    }
    const { error } = await admin.from("questions").update(patch).eq("id", id).is("tenant_id", null).eq("status", "draft");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "delete_global") {
    const { data: used } = await admin.from("exam_questions").select("exam_id").eq("question_id", id).limit(1);
    if (used?.length) {
      return NextResponse.json({ ok: false, error: "in_use", message: "مستخدم في امتحانات — لا يمكن حذفه" }, { status: 400 });
    }
    const { error } = await admin.from("questions").delete().eq("id", id).is("tenant_id", null);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action });
  }

  const { data: q } = await admin.from("questions").select("*").eq("id", id).single();
  if (!q || (q as any).visibility !== "private" || (q as any).status !== "pending") {
    return NextResponse.json({ ok: false, error: "not_pending" }, { status: 404 });
  }

  if (action === "reject") {
    await admin.from("questions").update({ status: "rejected" }).eq("id", id);
    return NextResponse.json({ ok: true, action });
  }

  // approve: نسخة عامة جديدة + اعتماد الأصل خاصاً + توثيق المرجع
  const reviewerId = g.ctx!.adminId;
  const clone: any = {
    tenant_id: null,
    subject: (q as any).subject, lesson: (q as any).lesson, lesson_code: (q as any).lesson_code ?? null,
    difficulty: (q as any).difficulty, qtype: (q as any).qtype, body: (q as any).body,
    options: (q as any).options, correct_answer: (q as any).correct_answer, marks: (q as any).marks,
    book_id: (q as any).book_id ?? null, source: (q as any).source ?? "teacher",
    source_detail: (q as any).source_detail ?? null,
    visibility: "shared", status: "approved",
    reviewed_by: reviewerId, reviewed_at: new Date().toISOString(),
  };
  const { error: cErr } = await admin.from("questions").insert(clone);
  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  await admin.from("questions").update({ status: "approved" }).eq("id", id);
  return NextResponse.json({ ok: true, action });
}
