import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

/** GET /api/agent/threads — محادثاتي. POST { title? } — محادثة جديدة. */
export async function GET() {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  try {
    const { data, error } = await admin.from("agent_threads").select("id,title,created_at")
      .eq("tenant_id", res.ctx.tenantId).eq("user_id", res.ctx.userRow.id)
      .order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return NextResponse.json({ ok: true, threads: data ?? [] });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 400 });
    return dbFail("agent-threads", e);
  }
}

export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const body = await req.json().catch(() => ({} as any));
  try {
    const { data, error } = await admin.from("agent_threads").insert({
      tenant_id: res.ctx.tenantId, user_id: res.ctx.userRow.id,
      title: String(body.title ?? "محادثة جديدة").slice(0, 100),
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any).id });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 400 });
    return dbFail("agent-threads", e);
  }
}
