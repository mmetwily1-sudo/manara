import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

async function monthStats(admin: any, tid: string, y: number, m: number) {
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nd = new Date(y, m, 1);
  const to = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: pay }, { count: reg }, { count: att }] = await Promise.all([
    admin.from("payments").select("amount").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", from).lt("paid_at", to).limit(3000),
    admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student").gte("created_at", from).lt("created_at", to),
    admin.from("attendance").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "present").gte("created_at", from).lt("created_at", to),
  ]);
  return {
    key: from.slice(0, 7),
    collected: ((pay ?? []) as any[]).reduce((s, p) => s + Number(p.amount ?? 0), 0),
    registered: reg ?? 0, attendances: att ?? 0,
  };
}

/** GET /api/analytics/compare — الشهري الحالي مقابل السابق ومقابل العام الماضي + دفعات التسجيل */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const n = new Date();
  const cy = n.getFullYear(), cm = n.getMonth() + 1;
  const pm = cm === 1 ? { y: cy - 1, m: 12 } : { y: cy, m: cm - 1 };

  const [cur, prev, yoy] = await Promise.all([
    monthStats(admin, tid, cy, cm),
    monthStats(admin, tid, pm.y, pm.m),
    monthStats(admin, tid, cy - 1, cm),
  ]);

  // الدفعات: آخر 6 شهور تسجيل → كم ما زال نشطاً
  const cohorts: { month: string; registered: number; active: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(cy, cm - 1 - i, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const nx = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const to = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: regs } = await admin.from("users").select("id").eq("tenant_id", tid).eq("role", "student")
      .gte("created_at", from).lt("created_at", to).limit(2000);
    const ids = ((regs ?? []) as any[]).map((r) => r.id);
    let active = 0;
    if (ids.length) {
      const { data: enr } = await admin.from("enrollments").select("student_id")
        .eq("tenant_id", tid).eq("status", "active").in("student_id", ids).limit(2000);
      active = new Set(((enr ?? []) as any[]).map((e) => e.student_id)).size;
    }
    cohorts.push({ month: from.slice(0, 7), registered: ids.length, active });
  }

  const delta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0);
  return NextResponse.json({
    ok: true,
    periods: { cur, prev, yoy },
    deltas: {
      vsPrev: { collected: delta(cur.collected, prev.collected), registered: delta(cur.registered, prev.registered) },
      vsYoy: { collected: delta(cur.collected, yoy.collected), registered: delta(cur.registered, yoy.registered) },
    },
    cohorts,
  });
}
