import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/attendance/monthly — نسبة حضور كل طالب هذا الشهر (طاقم) */
export async function GET() {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data } = await admin.from("attendance").select("student_id,status")
    .eq("tenant_id", tid).gte("created_at", monthStart.toISOString()).limit(10000);
  const agg: Record<string, { p: number; a: number }> = {};
  ((data ?? []) as any[]).forEach((r) => {
    const o = agg[r.student_id] ??= { p: 0, a: 0 };
    if (r.status === "present") o.p++;
    else if (r.status === "absent") o.a++;
  });
  const rates: Record<string, { present: number; absent: number; rate: number | null }> = {};
  Object.entries(agg).forEach(([sid, o]) => {
    const t = o.p + o.a;
    rates[sid] = { present: o.p, absent: o.a, rate: t ? Math.round((o.p / t) * 100) : null };
  });
  return NextResponse.json({ ok: true, rates });
}
