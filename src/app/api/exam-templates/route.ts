import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/exam-templates — مكتبة قوالب امتحانات السنتر (معلم + مشرف) */
export async function GET() {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("exam_templates")
    .select("id,title,subject,blueprint,duration_minutes,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({
    ok: true,
    templates: ((data ?? []) as any[]).map((t) => ({
      id: t.id, title: t.title, subject: t.subject, duration_minutes: t.duration_minutes,
      questions: ((t.blueprint as any)?.question_ids ?? []).length,
    })),
  });
}

/**
 * POST /api/exam-templates
 * - {action:"save", exam_id, title?} حفظ امتحان كقالب (لقطة أسئلة)
 * - {action:"use", template_id, title?} إنشاء مسودة من قالب
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));

  if (b?.action === "save") {
    const { data: ex } = await sb.from("exams").select("id,title,duration_minutes")
      .eq("id", b.exam_id).eq("tenant_id", tid).single();
    if (!ex) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const { data: links } = await sb.from("exam_questions").select("question_id,position,marks")
      .eq("exam_id", b.exam_id).eq("tenant_id", tid).order("position", { ascending: true }).limit(200);
    const title = String(b?.title ?? `${(ex as any).title} (قالب)`).trim().slice(0, 120);
    const { data: tpl, error } = await sb.from("exam_templates").insert({
      tenant_id: tid, title, subject: "",
      blueprint: { question_ids: ((links ?? []) as any[]).map((l) => ({ q: l.question_id, p: l.position, m: l.marks })) },
      duration_minutes: (ex as any).duration_minutes ?? 30,
    }).select("id").single();
    if (error || !tpl) return dbFail("template-save", error);
    return NextResponse.json({ ok: true, id: (tpl as any).id, questions: (links ?? []).length });
  }

  if (b?.action === "use") {
    const { data: tpl } = await sb.from("exam_templates").select("id,title,blueprint,duration_minutes")
      .eq("id", b.template_id).eq("tenant_id", tid).single();
    if (!tpl) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const ids = (((tpl as any).blueprint as any)?.question_ids ?? []) as any[];
    const qids = ids.map((x) => (typeof x === "string" ? x : x.q)).filter(Boolean);
    // تحقق أن الأسئلة ما زالت موجودة بسنتره
    let valid: string[] = [];
    if (qids.length) {
      const { data: qs } = await sb.from("questions").select("id").eq("tenant_id", tid).in("id", qids.slice(0, 200));
      const ok = new Set(((qs ?? []) as any[]).map((q) => q.id));
      valid = qids.filter((id: string) => ok.has(id));
    }
    const title = String(b?.title ?? `${(tpl as any).title} (من قالب)`).trim().slice(0, 120);
    const { data: neo, error } = await sb.from("exams").insert({
      tenant_id: tid, title, duration_minutes: (tpl as any).duration_minutes ?? 30, is_published: false,
    }).select("id").single();
    if (error || !neo) return dbFail("template-use", error);
    if (valid.length) {
      await sb.from("exam_questions").insert(valid.map((qid, i) => {
        const meta = ids.find((x: any) => (typeof x === "string" ? x === qid : x.q === qid)) as any;
        return { tenant_id: tid, exam_id: (neo as any).id, question_id: qid, position: i + 1, marks: Number(meta?.m) || 1 };
      }));
    }
    try {
      await sb.from("audit_log").insert({
        tenant_id: tid, actor_id: res.ctx.userRow.id,
        action: "exam:from_template", entity_type: "exam", entity_id: (neo as any).id,
        details: { template: (tpl as any).id, questions: valid.length },
      });
    } catch {}
    return NextResponse.json({ ok: true, id: (neo as any).id, questions: valid.length });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
