import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/forum — نقاشات السنتر (طالب: مجموعاته + العام) مع عدد الردود */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role,full_name").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const isTeacher = (urow as any).role !== "student";

  let gids: string[] | null = null;
  if (!isTeacher) {
    const { data: en } = await admin.from("enrollments").select("group_id")
      .eq("tenant_id", tid).eq("student_id", (urow as any).id).eq("status", "active");
    gids = ((en ?? []) as any[]).map((e) => e.group_id);
  }
  let q = admin.from("threads").select("id,group_id,locked,groups(name)").eq("tenant_id", tid).eq("ttype", "discussion")
    .order("id", { ascending: false }).limit(50);
  if (!isTeacher && gids) {
    q = gids.length ? q.or(`group_id.is.null,group_id.in.(${gids.join(",")})`) : q.is("group_id", null);
  }
  const { data: threads, error } = await q;
  if (error) return dbFail("forum-list", error);
  const tids = ((threads ?? []) as any[]).map((t) => t.id);
  let counts: Record<string, number> = {};
  let firsts: Record<string, { body: string; sender: string }> = {};
  if (tids.length) {
    const { data: msgs } = await admin.from("messages").select("thread_id,body,sender_id,created_at")
      .in("thread_id", tids).is("deleted_at", null).order("created_at", { ascending: true }).limit(1000);
    const sids = Array.from(new Set(((msgs ?? []) as any[]).map((m) => m.sender_id).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
    for (const m of (msgs ?? []) as any[]) {
      counts[m.thread_id] = (counts[m.thread_id] ?? 0) + 1;
      if (!firsts[m.thread_id]) firsts[m.thread_id] = { body: m.body ?? "", sender: names[m.sender_id] ?? "" };
    }
  }
  return NextResponse.json({
    ok: true, isTeacher,
    threads: ((threads ?? []) as any[]).map((t) => ({
      id: t.id, group: (t.groups as any)?.name ?? "عام", locked: !!(t as any).locked,
      replies: Math.max(0, (counts[t.id] ?? 0) - 1),
      first: firsts[t.id] ?? null,
    })).filter((t) => t.first),
  });
}

/** POST /api/forum {group_id?, title, body} — موضوع نقاش جديد (طالب ومعلم) */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const b = await req.json().catch(() => ({} as any));
  const title = String(b?.title ?? "").trim().slice(0, 150);
  const body = String(b?.body ?? "").trim().slice(0, 2000);
  if (!title || !body) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  let groupId: string | null = b?.group_id || null;
  if (groupId) {
    const { data: g } = await admin.from("groups").select("id").eq("id", groupId).eq("tenant_id", tid).single();
    if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });
    if ((urow as any).role === "student") {
      const { data: en } = await admin.from("enrollments").select("id").eq("tenant_id", tid)
        .eq("student_id", (urow as any).id).eq("group_id", groupId).eq("status", "active").limit(1).single();
      if (!en) return NextResponse.json({ ok: false, error: "not_yours" }, { status: 403 });
    }
  }
  const { data: th, error: e1 } = await admin.from("threads").insert({
    tenant_id: tid, group_id: groupId, ttype: "discussion",
  }).select("id").single();
  if (e1 || !th) return dbFail("forum-create", e1);
  const { error: e2 } = await admin.from("messages").insert({
    tenant_id: tid, thread_id: (th as any).id, sender_id: (urow as any).id, mtype: "text",
    body: `**${title}**\n${body}`,
  });
  if (e2) return dbFail("forum-create", e2);
  return NextResponse.json({ ok: true, id: (th as any).id });
}
