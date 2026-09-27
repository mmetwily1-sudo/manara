import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/sessions/swap {session_id, substitute_id} — تعيين بديل للحصة (مالك + مشرف).
 * البديل يجب أن يكون من طاقم نفس السنتر.
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: s } = await sb.from("sessions").select("id,group_id").eq("id", b?.session_id).eq("tenant_id", tid).single();
  if (!s) return NextResponse.json({ ok: false, error: "bad_session" }, { status: 404 });
  const { data: sub } = await sb.from("users").select("id,full_name").eq("id", b?.substitute_id).eq("tenant_id", tid)
    .in("role", ["teacher_admin", "supervisor", "assistant"]).single();
  if (!sub) return NextResponse.json({ ok: false, error: "bad_substitute" }, { status: 400 });
  const { error } = await sb.from("sessions").update({ substitute_id: (sub as any).id }).eq("id", (s as any).id);
  if (error) return dbFail("session-swap", error);
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "session:swap", entity_type: "session", entity_id: (s as any).id,
      details: { substitute: (sub as any).full_name },
    });
  } catch {}
  return NextResponse.json({ ok: true, substitute: (sub as any).full_name });
}
