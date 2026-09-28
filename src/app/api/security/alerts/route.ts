import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/security/alerts — مالك: الكل | طاقم: تنبيهاتي */
export async function GET() {
  const res = await requireTeacher(["teacher_admin", "supervisor", "assistant", "accountant"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const isOwner = res.ctx.userRow.role === "teacher_admin";
  let q = admin.from("security_alerts").select("id,user_id,label,status,created_at")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100);
  if (!isOwner) q = q.eq("user_id", res.ctx.userRow.id);
  const { data: rows, error } = await q;
  if (error) return dbFail("alerts-list", error);
  let names: Record<string, string> = {};
  if (isOwner) {
    const uids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.user_id)));
    if (uids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", uids as string[]);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
  }
  return NextResponse.json({
    ok: true, isOwner,
    fresh: ((rows ?? []) as any[]).filter((r) => r.status === "new").length,
    rows: ((rows ?? []) as any[]).map((r) => ({ ...r, name: names[r.user_id] ?? "" })),
  });
}

/** PATCH /api/security/alerts {id?|all} — تعليم كمقروء (صاحبه أو المالك) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin", "supervisor", "assistant", "accountant"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const isOwner = res.ctx.userRow.role === "teacher_admin";
  const b = await req.json().catch(() => ({} as any));
  let q = admin.from("security_alerts").update({ status: "seen" }).eq("tenant_id", tid).eq("status", "new");
  if (!isOwner) q = q.eq("user_id", res.ctx.userRow.id);
  else if (b?.id) q = q.eq("id", b.id);
  const { error } = await q;
  if (error) return dbFail("alerts-seen", error);
  return NextResponse.json({ ok: true });
}
