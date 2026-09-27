import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/team/tasks — مهام الطاقم (كل الطاقم يرى — التنفيذ للجميع) */
export async function GET() {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("staff_tasks")
    .select("id,title,assignee_id,due_date,status,created_at,users(full_name)")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
  return NextResponse.json({ ok: true, tasks: data ?? [] });
}

/** POST /api/team/tasks {title, assignee_id?, due_date?} — مهمة جديدة (مالك + مشرف) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const title = String(b?.title ?? "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
  const { data, error } = await res.ctx.admin.from("staff_tasks").insert({
    tenant_id: res.ctx.tenantId, title,
    assignee_id: b?.assignee_id || null, due_date: b?.due_date || null,
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("task-create", error);
  // إشعار المكلف فوراً (best-effort)
  if (b?.assignee_id && b.assignee_id !== res.ctx.userRow.id) {
    try {
      const { sendPushToUser } = await import("@/lib/push");
      await sendPushToUser(res.ctx.admin, res.ctx.tenantId, b.assignee_id, {
        title: "مهمة جديدة 📝", body: title.slice(0, 120), url: "/dashboard/team",
      });
    } catch {}
  }
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/team/tasks {id, status} — إنجاز/إلغاء (المكلف أو المالك) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["done", "cancelled", "open"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const patch: any = { status: b.status };
  if (b.status === "done") patch.done_at = new Date().toISOString();
  const { error } = await res.ctx.admin.from("staff_tasks").update(patch)
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("task-update", error);
  return NextResponse.json({ ok: true });
}
