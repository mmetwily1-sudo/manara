import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/students/[id]/suspend {until?: YYYY-MM-DD} — إيقاف مؤقت (مالك فقط).
 * بلا تاريخ = فك الإيقاف. الموقوف يُمنع من التحضير ودخول الامتحانات.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const b = await req.json().catch(() => ({} as any));
  const until = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.until ?? "")) ? String(b.until) : null;
  const { data: st } = await sb.from("users").select("id").eq("id", params.id)
    .eq("tenant_id", res.ctx.tenantId).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { error } = await sb.from("users").update({ suspended_until: until }).eq("id", params.id);
  if (error) return dbFail("suspend", error);
  try {
    await sb.from("audit_log").insert({
      tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
      action: until ? "student:suspend" : "student:unsuspend",
      entity_type: "student", entity_id: params.id, details: { until },
    });
  } catch {}
  return NextResponse.json({ ok: true, suspended_until: until });
}
