import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/notes — قائمة المذكرات (معلم: الكل، طالب: مجموعاته) */
export async function GET(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const isTeacher = res.ctx.userRow.role === "teacher_admin";

  let q = admin.from("notes").select("id,title,subject,lesson,visibility,created_at,updated_at,created_by")
    .eq("tenant_id", tid).order("updated_at", { ascending: false }).limit(200);

  if (!isTeacher) {
    const { data: enr } = await admin.from("enrollments").select("group_id")
      .eq("tenant_id", tid).eq("student_id", res.ctx.userRow.id).eq("status", "active");
    const gids = ((enr ?? []) as any[]).map((e) => e.group_id);
    q = gids.length
      ? q.or(`visibility.eq.public,group_id.in.(${gids.join(",")})`)
      : q.eq("visibility", "public");
  }

  const { data } = await q;
  return NextResponse.json({ ok: true, notes: data ?? [] });
}

/** POST /api/notes — إنشاء/تحديث مذكرة (معلم فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin", "supervisor"], { req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));

  const title = String(b?.title ?? "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });

  const body = String(b?.content ?? "").trim().slice(0, 50000);
  const subject = String(b?.subject ?? "").trim().slice(0, 80);
  const lesson = String(b?.lesson ?? "").trim().slice(0, 120);
  const visibility = ["public", "group", "private"].includes(b?.visibility) ? b.visibility : "group";
  const groupId = b?.group_id ? String(b.group_id) : null;

  if (visibility === "group" && !groupId) {
    return NextResponse.json({ ok: false, error: "group_required_for_group_visibility" }, { status: 400 });
  }

  const id = b?.id ? String(b.id) : null;
  if (id) {
    const { data, error } = await admin.from("notes").update({
      title, subject, lesson, content: body, visibility,
      group_id: groupId, updated_at: new Date().toISOString()
    }).eq("id", id).eq("tenant_id", tid).select("id").single();
    if (error || !data) return dbFail("note-update", error);
    return NextResponse.json({ ok: true, id: (data as any).id });
  }

  const { data, error } = await admin.from("notes").insert({
    tenant_id: tid, title, subject, lesson, content: body,
    visibility, group_id: groupId, created_by: res.ctx.userRow.id
  }).select("id").single();
  if (error || !data) return dbFail("note-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/notes {id, ...} — تحديث جزئي (معلم فقط) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin", "supervisor"], { req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));

  const id = String(b?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const allowed = ["title", "subject", "lesson", "content", "visibility", "group_id"];
  const patch: any = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (b[k] !== undefined) patch[k] = b[k];
  if (patch.visibility && !["public", "group", "private"].includes(patch.visibility)) {
    return NextResponse.json({ ok: false, error: "bad_visibility" }, { status: 400 });
  }

  const { error } = await admin.from("notes").update(patch).eq("id", id).eq("tenant_id", tid);
  if (error) return dbFail("note-patch", error);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/notes?id= — حذف (مالك فقط) */
export async function DELETE(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const { error } = await res.ctx.admin.from("notes").delete().eq("id", id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("note-delete", error);
  return NextResponse.json({ ok: true });
}