import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/**
 * GET /api/announcements — إعلانات السنتر (العام + مجموعاتي). طالب ومعلم.
 * POST /api/announcements { group_id?|null, body } — نشر إعلان (معلم).
 * كل إعلان = thread + أول رسالة (بدون ترحيل جديد).
 */
async function ctx() {
  const { requireTeacher } = await import("@/lib/server-auth");
  return requireTeacher(["teacher_admin"]);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin
    .from("users").select("id,tenant_id,role,full_name").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const isTeacher = (urow as any).role === "teacher_admin";

  let gids: string[] | null = null;
  if (!isTeacher) {
    const { data: en } = await admin.from("enrollments").select("group_id")
      .eq("tenant_id", tid).eq("student_id", (urow as any).id).eq("status", "active");
    gids = ((en ?? []) as any[]).map((e) => e.group_id);
  }

  let q = admin.from("threads").select("id,group_id,groups(name)").eq("tenant_id", tid).eq("ttype", "announcement").order("id", { ascending: false }).limit(30);
  if (!isTeacher && gids) {
    q = gids.length ? q.or(`group_id.is.null,group_id.in.(${gids.join(",")})`) : q.is("group_id", null);
  }
  const { data: threads, error } = await q;
  if (error) return dbFail("ann-list", error);
  const tids = ((threads ?? []) as any[]).map((t) => t.id);
  let bodies: Record<string, { body: string; created_at: string; sender: string }> = {};
  if (tids.length) {
    const { data: msgs } = await admin.from("messages")
      .select("thread_id,body,created_at,sender_id").in("thread_id", tids).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(200);
    const sids = Array.from(new Set(((msgs ?? []) as any[]).map((m) => m.sender_id).filter(Boolean)));
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids);
      for (const u of (us ?? []) as any[]) names[u.id] = u.full_name ?? "";
    }
    for (const m of (msgs ?? []) as any[]) {
      if (!bodies[m.thread_id]) {
        bodies[m.thread_id] = { body: m.body ?? "", created_at: m.created_at, sender: names[m.sender_id] ?? "" };
      }
    }
  }
  return NextResponse.json({
    ok: true,
    announcements: ((threads ?? []) as any[]).map((t) => ({
      id: t.id,
      group_name: (t.groups as any)?.name ?? "عام للسنتر",
      body: bodies[t.id]?.body ?? "",
      sender: bodies[t.id]?.sender ?? "",
      created_at: bodies[t.id]?.created_at ?? null,
    })).filter((a) => a.body),
  });
}

export async function POST(req: Request) {
  const res = await ctx();
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "announce", 20, 60 * 60 * 1000, tid)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({} as any));
  const text = String(body.body ?? "").trim().slice(0, 2000);
  if (text.length < 2) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  let groupId: string | null = body.group_id ?? null;
  if (groupId) {
    const { data: g } = await admin.from("groups").select("id").eq("id", groupId).eq("tenant_id", tid).single();
    if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });
  }
  const { data: th, error: e1 } = await admin.from("threads").insert({
    tenant_id: tid, group_id: groupId, ttype: "announcement",
  }).select("id").single();
  if (e1) return dbFail("ann-create", e1);
  const { error: e2 } = await admin.from("messages").insert({
    tenant_id: tid, thread_id: (th as any).id, sender_id: res.ctx.userRow.id, mtype: "text", body: text,
  });
  if (e2) return dbFail("ann-create", e2);
  return NextResponse.json({ ok: true, id: (th as any).id });
}
