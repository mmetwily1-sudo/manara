import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

async function ctx() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/forum/[id] — رسائل النقاش */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const c = await ctx();
  if (!c) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { data: th } = await c.admin.from("threads").select("id,group_id,locked,pinned,category")
    .eq("id", params.id).eq("tenant_id", c.urow.tenant_id).eq("ttype", "discussion").single();
  if (!th) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { data: msgs } = await c.admin.from("messages").select("id,body,sender_id,created_at,users!messages_sender_id_fkey(full_name)")
    .eq("thread_id", params.id).is("deleted_at", null).order("created_at", { ascending: true }).limit(200);
  return NextResponse.json({
    ok: true, locked: !!(th as any).locked, pinned: !!(th as any).pinned, category: (th as any).category ?? "general",
    messages: ((msgs ?? []) as any[]).map((m) => ({
      id: m.id, body: m.body, sender: (m.users as any)?.full_name ?? "", mine: m.sender_id === c.urow.id,
      created_at: m.created_at,
    })),
  });
}

/** POST /api/forum/[id] {body} — رد (ممنوع عند القفل إلا للمعلم) */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const c = await ctx();
  if (!c) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const isTeacher = c.urow.role !== "student";
  if (isTeacher) {
    const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(c.admin, c.urow.tenant_id, c.urow.role);
    if (_sw) return _sw;
  }
  const { data: th } = await c.admin.from("threads").select("id,locked,group_id")
    .eq("id", params.id).eq("tenant_id", c.urow.tenant_id).eq("ttype", "discussion").single();
  if (!th) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if ((th as any).locked && !isTeacher) return NextResponse.json({ ok: false, error: "locked" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const body = String(b?.body ?? "").trim().slice(0, 2000);
  if (!body) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const { error } = await c.admin.from("messages").insert({
    tenant_id: c.urow.tenant_id, thread_id: params.id, sender_id: c.urow.id, mtype: "text", body,
  });
  if (error) return dbFail("forum-reply", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/forum/[id] {action:"lock"|"unlock"|"pin"|"unpin"|"delete_msg"|"move", message_id?, target_category?} — إشراف المعلم */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const c = await ctx();
  if (!c) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (c.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(c.admin, c.urow.tenant_id, c.urow.role);
  if (_sw) return _sw;
  const b = await req.json().catch(() => ({} as any));
  if (b?.action === "lock" || b?.action === "unlock") {
    await c.admin.from("threads").update({ locked: b.action === "lock" }).eq("id", params.id).eq("tenant_id", c.urow.tenant_id);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "pin" || b?.action === "unpin") {
    await c.admin.from("threads").update({ pinned: b.action === "pin" }).eq("id", params.id).eq("tenant_id", c.urow.tenant_id);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "delete_msg" && b?.message_id) {
    await c.admin.from("messages").update({ deleted_at: new Date().toISOString() })
      .eq("id", b.message_id).eq("tenant_id", c.urow.tenant_id);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "move" && b?.target_category) {
    await c.admin.from("threads").update({ category: b.target_category }).eq("id", params.id).eq("tenant_id", c.urow.tenant_id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}