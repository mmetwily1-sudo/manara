import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * POST /api/me/assignments/[id]/submit — تسليم الواجب (طالب، ملفات صور/PDF).
 * يُنشئ نسخة جديدة أو يستبدل تسليماً غير مُصحح. المتأخر يُقبل كـ late.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin
    .from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;

  const { data: a } = await admin
    .from("assignments").select("id,group_id,due_at,allow_late,answer_key,max_score")
    .eq("id", params.id).eq("tenant_id", tid).single();
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // الطالب في مجموعة الواجب؟
  const { data: en } = await admin
    .from("enrollments").select("id").eq("tenant_id", tid).eq("student_id", sid)
    .eq("group_id", (a as any).group_id).eq("status", "active").single();
  if (!en) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const due = (a as any).due_at ? new Date((a as any).due_at).getTime() : null;
  const late = due !== null && due < Date.now();
  if (late && !(a as any).allow_late) {
    return NextResponse.json({ ok: false, error: "closed", message: "انتهى موعد التسليم." }, { status: 400 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }
  const answerText = String(form.get("answer_text") ?? "").trim().slice(0, 2000);
  // تصحيح ذاتي: مفتاح موجود + إجابة نصية مطابقة = درجة كاملة فوراً
  const key = String((a as any).answer_key ?? "").trim();
  const autoGrade = !!key && !!answerText && key.replace(/\s+/g, " ") === answerText.replace(/\s+/g, " ");
  const files = [...form.getAll("files")].filter(
    (f): f is File => f instanceof Blob && (f as File).size > 0
  );
  if (!files.length && !answerText) {
    return NextResponse.json({ ok: false, error: "empty", message: "صوّر حل الواجب أو اكتب الإجابة النصية." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ ok: false, error: "too_many", message: `حتى ${MAX_FILES} ملفات.` }, { status: 400 });
  }
  for (const f of files as File[]) {
    if (!ALLOWED.has(f.type)) {
      return NextResponse.json({ ok: false, error: "bad_type", message: "الملفات المقبولة: صور و PDF فقط." }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "too_large", message: "حجم الملف يتجاوز 10MB." }, { status: 400 });
    }
  }

  try { await admin.storage.createBucket("homework", { public: false }); } catch {}
  const urls: string[] = [];
  let n = 0;
  for (const f of files as File[]) {
    const ext = (f.type === "application/pdf" ? "pdf" : f.type.split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "");
    const dst = `${tid}/${params.id}/${sid}/${Date.now()}-${++n}.${ext}`;
    const { error } = await admin.storage.from("homework").upload(dst, Buffer.from(await f.arrayBuffer()), {
      contentType: f.type, upsert: true,
    });
    if (error) return dbFail("hw-upload", error, "upload_failed");
    urls.push(dst);
  }

  // موجود مسبقاً؟ استبدال مسموح ما لم يُصحح
  const { data: prev } = await admin.from("submissions")
    .select("id,status").eq("assignment_id", params.id).eq("student_id", sid).eq("tenant_id", tid).single();
  if (prev && (prev as any).status === "graded") {
    return NextResponse.json({ ok: false, error: "graded", message: "تم تصحيح تسليمك — لا يمكن التعديل." }, { status: 400 });
  }
  const row: Record<string, unknown> = {
    tenant_id: tid, assignment_id: params.id, student_id: sid,
    file_urls: urls, answer_text: answerText || null,
    status: autoGrade ? "graded" : late ? "late" : "submitted",
    score: autoGrade ? Number((a as any).max_score ?? 10) : null,
    feedback_text: autoGrade ? "تصحيح ذاتي ✅" : null,
    submitted_at: new Date().toISOString(),
  };
  const isFirst = !prev;
  let error = null;
  if (prev) ({ error } = await admin.from("submissions").update({ ...row, score: null, feedback_text: null }).eq("id", (prev as any).id));
  else ({ error } = await admin.from("submissions").insert(row));
  if (error) return dbFail("hw-submit", error);

  if (isFirst) {
    const { awardPoints, POINTS } = await import("@/lib/gamification");
    await awardPoints(admin, tid, sid, POINTS.submit);
  }

  // إشعار المعلم (مالك السنتر) — best-effort لا يفشل التسليم
  try {
    const { notifyStudent } = await import("@/lib/notify");
    const { data: trow } = await admin.from("tenants").select("owner_user_id").eq("id", tid).single();
    const { data: asn } = await admin.from("assignments").select("title").eq("id", params.id).single();
    const { data: st } = await admin.from("users").select("full_name").eq("id", sid).single();
    if ((trow as any)?.owner_user_id) {
      await notifyStudent(admin, {
        tenantId: tid,
        studentId: (trow as any).owner_user_id,
        event: { kind: "homework_submitted", studentName: (st as any)?.full_name ?? "طالب", hwTitle: (asn as any)?.title ?? "واجب" },
        dedupeKey: `hw-sub:${params.id}:${sid}:${late ? "late" : "ok"}`,
      });
    }
  } catch {}
  return NextResponse.json({ ok: true, late });
}
