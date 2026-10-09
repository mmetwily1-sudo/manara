import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/branches/contest?month=YYYY-MM — ترتيب الفروع بالنقاط (معلم) */
export async function GET(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [{ data: branches }, { data: pts }] = await Promise.all([
    admin.from("branches").select("id,name").eq("tenant_id", tid).limit(50),
    admin.from("branch_points").select("branch_id,points").eq("tenant_id", tid).eq("month", month).limit(1000),
  ]);
  const totals: Record<string, number> = {};
  ((pts ?? []) as any[]).forEach((p) => { totals[p.branch_id] = (totals[p.branch_id] ?? 0) + Number(p.points ?? 0); });
  const rows = ((branches ?? []) as any[])
    .map((b) => ({ id: b.id, name: b.name, points: totals[b.id] ?? 0 }))
    .sort((a, b) => b.points - a.points);
  return NextResponse.json({ ok: true, month, isOwner: res.ctx.userRow.role === "teacher_admin", rows });
}

/** POST /api/branches/contest {branch_id, month, points, reason?} — منح نقاط (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const points = Number(b?.points ?? NaN);
  const month = String(b?.month ?? "");
  if (!b?.branch_id || !/^\d{4}-\d{2}$/.test(month) || !(points > 0 && points <= 1000)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: br } = await admin.from("branches").select("id").eq("id", b.branch_id).eq("tenant_id", tid).single();
  if (!br) return NextResponse.json({ ok: false, error: "bad_branch" }, { status: 400 });
  const { error } = await admin.from("branch_points").insert({
    tenant_id: tid, branch_id: b.branch_id, month, points, reason: String(b?.reason ?? "").slice(0, 200),
  });
  if (error) return dbFail("branch-points", error);
  return NextResponse.json({ ok: true });
}
