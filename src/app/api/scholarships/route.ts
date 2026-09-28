import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/scholarships — المنح النشطة + الأسماء (تحصيل) */
export async function GET() {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: rows, error } = await admin.from("scholarships")
    .select("id,student_id,pct,reason,active,created_at").eq("tenant_id", tid)
    .order("created_at", { ascending: false }).limit(500);
  if (error) return dbFail("scholarships-list", error);
  const sids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.student_id)));
  let names: Record<string, string> = {};
  if (sids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  return NextResponse.json({
    ok: true,
    rows: ((rows ?? []) as any[]).map((r) => ({ ...r, student: names[r.student_id] ?? "" })),
  });
}

/** POST /api/scholarships {student_id, pct, reason?} — منحة جديدة/تحديث (تحصيل) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const pct = Number(b?.pct ?? NaN);
  if (!b?.student_id || !(pct >= 1 && pct <= 100)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: st } = await admin.from("users").select("id").eq("id", b.student_id)
    .eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { error } = await admin.from("scholarships").upsert(
    { tenant_id: tid, student_id: b.student_id, pct, reason: String(b?.reason ?? "").slice(0, 200), active: true },
    { onConflict: "tenant_id,student_id" }
  );
  if (error) return dbFail("scholarship-save", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/scholarships {id, active} — تفعيل/إيقاف */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await res.ctx.admin.from("scholarships").update({ active: !!b.active })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("scholarship-toggle", error);
  return NextResponse.json({ ok: true });
}
