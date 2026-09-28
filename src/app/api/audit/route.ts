import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/audit?action=&q=&limit= — سجل التدقيق بفلاتر (مالك فقط) */
export async function GET(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const q = url.searchParams.get("q") || "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  let query = admin.from("audit_log").select("id,actor_id,action,entity_type,entity_id,details,created_at")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(limit);
  if (action) query = query.ilike("action", `${action}%`);
  const { data: rows, error } = await query;
  if (error) return dbFail("audit-list", error);
  const aids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.actor_id).filter(Boolean)));
  let names: Record<string, string> = {};
  if (aids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", aids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  let out = ((rows ?? []) as any[]).map((r) => ({ ...r, actor: names[r.actor_id] ?? "" }));
  if (q) {
    const needle = q.trim();
    out = out.filter((r) => `${r.action} ${r.actor} ${r.entity_id} ${JSON.stringify(r.details)}`.includes(needle));
  }
  const actions = Array.from(new Set(out.map((r) => String(r.action).split(":")[0]))).sort();
  return NextResponse.json({ ok: true, groups: actions, rows: out });
}
