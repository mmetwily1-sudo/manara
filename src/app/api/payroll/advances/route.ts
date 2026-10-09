import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { STAFF_ROLES } from "@/lib/permissions";

/** GET /api/payroll/advances — السلف المعلقة + أسماء (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: advances, error } = await admin.from("staff_advances")
    .select("id,user_id,amount,reason,created_at").eq("tenant_id", tid).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(200);
  if (error) return dbFail("advances-list", error);
  const uids = Array.from(new Set(((advances ?? []) as any[]).map((a) => a.user_id)));
  let names: Record<string, string> = {};
  if (uids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", uids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  return NextResponse.json({
    ok: true,
    staff: (((await admin.from("users").select("id,full_name").eq("tenant_id", tid)
      .in("role", ["teacher_admin", ...STAFF_ROLES]).limit(200)).data ?? []) as any[])
      .map((u) => ({ id: u.id, name: u.full_name ?? "" })),
    advances: ((advances ?? []) as any[]).map((a) => ({ ...a, amount: Number(a.amount ?? 0), name: names[a.user_id] ?? "" })),
  });
}

/** POST /api/payroll/advances {user_id, amount, reason?} — سلفة جديدة (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const amount = Number(b?.amount ?? NaN);
  if (!b?.user_id || !(amount > 0 && amount <= 1000000)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: target } = await admin.from("users").select("id").eq("id", b.user_id).eq("tenant_id", tid).single();
  if (!target) return NextResponse.json({ ok: false, error: "bad_user" }, { status: 400 });
  const { error } = await admin.from("staff_advances").insert({
    tenant_id: tid, user_id: b.user_id, amount, reason: String(b?.reason ?? "").slice(0, 200),
  });
  if (error) return dbFail("advance-create", error);
  return NextResponse.json({ ok: true });
}
