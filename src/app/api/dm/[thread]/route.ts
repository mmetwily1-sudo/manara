import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** GET /api/dm/[thread] — رسائل محادثة (طرفاها فقط) */
export async function GET(_req: Request, { params }: { params: { thread: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const { data: d } = await admin.from("dm_threads").select("teacher_id,student_id")
    .eq("thread_id", params.thread).eq("tenant_id", (urow as any).tenant_id).single();
  if (!d) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const mine = (urow as any).role === "student" ? (d as any).student_id === (urow as any).id : (d as any).teacher_id === (urow as any).id;
  if (!mine) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { data: msgs } = await admin.from("messages").select("id,body,sender_id,created_at")
    .eq("thread_id", params.thread).is("deleted_at", null).order("created_at", { ascending: true }).limit(200);
  return NextResponse.json({
    ok: true,
    messages: ((msgs ?? []) as any[]).map((m) => ({ id: m.id, body: m.body, mine: m.sender_id === (urow as any).id, at: m.created_at })),
  });
}
