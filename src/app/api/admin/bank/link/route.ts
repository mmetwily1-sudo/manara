import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requirePlatformAdmin } from "@/lib/server-auth";

/**
 * POST /api/admin/bank/link { id, lesson_code }
 * تثبيت ربط درس على سؤال مشترك (بعد مراجعة بشرية للاقتراح).
 * يُسجَّل المراجِع والوقت في reviewed_by/at — أثر تدقيق كامل.
 */
export async function POST(req: Request) {
  const g = await requirePlatformAdmin();
  if ("error" in g) return g.error;
  const admin = g.ctx.admin;

  const body = await req.json().catch(() => ({} as any));
  const { id, lesson_code } = body ?? {};
  if (!id || typeof lesson_code !== "string" || !lesson_code) {
    return NextResponse.json({ ok: false, error: "id+lesson_code required" }, { status: 400 });
  }

  // 1) الدرس موجود فعلاً في المنهج؟
  const { data: lesson } = await admin
    .from("curriculum_lessons")
    .select("code,lesson_title,subject")
    .eq("code", lesson_code)
    .limit(1)
    .single();
  if (!lesson) return NextResponse.json({ ok: false, error: "bad_lesson" }, { status: 400 });

  // 2) السؤال مشترك ومعتمد؟
  const { data: q } = await admin
    .from("questions")
    .select("id,subject")
    .eq("id", id)
    .is("tenant_id", null)
    .eq("visibility", "shared")
    .eq("status", "approved")
    .single();
  if (!q) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // 3) تحذير عدم تطابق المادة (لا نمنع — المراجع مسؤول، لكن نسجله)
  const subjectMismatch = (lesson as any).subject !== (q as any).subject;

  const { error } = await admin
    .from("questions")
    .update({
      lesson_code,
      reviewed_by: g.ctx.adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("tenant_id", null);
  if (error) return dbFail("bank-link", error);

  await admin.from("audit_log").insert({
    actor_id: g.ctx.adminId,
    action: "bank:link-lesson",
    entity_type: "question",
    entity_id: id,
    details: { lesson_code, subjectMismatch },
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, lesson: (lesson as any).lesson_title, subjectMismatch });
}
