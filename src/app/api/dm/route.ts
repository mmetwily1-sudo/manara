import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role,full_name")
    .eq("auth_user_id", user.id).single();
  return urow ? { admin, urow: urow as any } : null;
}

/** GET /api/dm — محادثاتي (طالب: مع معلميه؛ طاقم: مع طلابه) + آخر رسالة */
export async function GET() {
  const c = await me();
  if (!c) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const tid = c.urow.tenant_id;
  const isStudent = c.urow.role === "student";
  let q = c.admin.from("dm_threads").select("id,thread_id,teacher_id,student_id,users_teacher:teacher_id(full_name),users_student:student_id(full_name)")
    .eq("tenant_id", tid);
  q = isStudent ? q.eq("student_id", c.urow.id) : q.eq("teacher_id", c.urow.id);
  const { data: dms } = await q.limit(50);
  const out = [];
  for (const d of (dms ?? []) as any[]) {
    const { data: last } = await c.admin.from("messages").select("body,created_at,sender_id")
      .eq("thread_id", d.thread_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).single();
    out.push({
      id: d.id, thread_id: d.thread_id,
      peer: isStudent ? (d.users_teacher?.full_name ?? "المعلم") : (d.users_student?.full_name ?? "الطالب"),
      last: (last as any)?.body ?? "", at: (last as any)?.created_at ?? null,
      unreadMine: !!last && (last as any).sender_id !== c.urow.id,
    });
  }
  out.sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  return NextResponse.json({ ok: true, isStudent, threads: out });
}

/** POST /api/dm {teacher_id?, thread_id?, body} — إرسال (طالب لمعلم مجموعاته / طاقم لطلابه) */
export async function POST(req: Request) {
  const c = await me();
  if (!c) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const tid = c.urow.tenant_id;
  const isStudent = c.urow.role === "student";
  const b = await req.json().catch(() => ({} as any));
  const body = String(b?.body ?? "").trim().slice(0, 2000);
  if (!body) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });

  let threadId: string | null = b?.thread_id || null;
  let teacherId: string | null = null;
  let studentId: string | null = null;
  if (threadId) {
    const { data: d } = await c.admin.from("dm_threads").select("thread_id,teacher_id,student_id")
      .eq("thread_id", threadId).eq("tenant_id", tid).single();
    if (!d) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    if (isStudent && (d as any).student_id !== c.urow.id) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    if (!isStudent && (d as any).teacher_id !== c.urow.id) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    teacherId = (d as any).teacher_id; studentId = (d as any).student_id;
  } else if (isStudent && b?.teacher_id) {
    // تحقق: المعلم يدرسني فعلاً
    const { data: enr } = await c.admin.from("enrollments").select("group_id")
      .eq("tenant_id", tid).eq("student_id", c.urow.id).eq("status", "active").limit(50);
    const gids = ((enr ?? []) as any[]).map((e) => e.group_id);
    if (!gids.length) return NextResponse.json({ ok: false, error: "no_groups" }, { status: 400 });
    const { data: g } = await c.admin.from("groups").select("id").eq("tenant_id", tid)
      .eq("teacher_id", b.teacher_id).in("id", gids).limit(1).single();
    if (!g) return NextResponse.json({ ok: false, error: "not_your_teacher" }, { status: 403 });
    teacherId = b.teacher_id; studentId = c.urow.id;
  } else if (!isStudent && b?.student_id) {
    const { data: gs } = await c.admin.from("groups").select("id").eq("tenant_id", tid).eq("teacher_id", c.urow.id).limit(100);
    const gg = ((gs ?? []) as any[]).map((g) => g.id);
    if (!gg.length) return NextResponse.json({ ok: false, error: "no_groups" }, { status: 400 });
    const { data: en } = await c.admin.from("enrollments").select("id").eq("tenant_id", tid)
      .eq("student_id", b.student_id).in("group_id", gg).eq("status", "active").limit(1).single();
    if (!en) return NextResponse.json({ ok: false, error: "not_your_student" }, { status: 403 });
    teacherId = c.urow.id; studentId = b.student_id;
  } else {
    return NextResponse.json({ ok: false, error: "target_required" }, { status: 400 });
  }

  // thread موجود أو جديد
  if (!threadId) {
    const { data: ex } = await c.admin.from("dm_threads").select("thread_id")
      .eq("tenant_id", tid).eq("teacher_id", teacherId).eq("student_id", studentId).single();
    if (ex) threadId = (ex as any).thread_id;
    else {
      const { data: th, error: e1 } = await c.admin.from("threads").insert({ tenant_id: tid, ttype: "dm" }).select("id").single();
      if (e1 || !th) return dbFail("dm-thread", e1);
      threadId = (th as any).id;
      await c.admin.from("dm_threads").insert({ tenant_id: tid, thread_id: threadId, teacher_id: teacherId, student_id: studentId });
    }
  }
  const { error } = await c.admin.from("messages").insert({
    tenant_id: tid, thread_id: threadId, sender_id: c.urow.id, mtype: "text", body,
  });
  if (error) return dbFail("dm-send", error);
  // push للطرف الآخر (best-effort)
  try {
    const { sendPushToUser } = await import("@/lib/push");
    const peer = isStudent ? teacherId : studentId;
    if (peer) await sendPushToUser(c.admin, tid, peer, { title: "رسالة جديدة 💬", body: body.slice(0, 100), url: isStudent ? "/progress" : "/dashboard/messages" });
  } catch {}
  return NextResponse.json({ ok: true, thread_id: threadId });
}
