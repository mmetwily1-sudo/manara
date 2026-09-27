import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/analytics/funnel — قمع تحويل الطلاب: مسجل → نشط → حاضر → دافع */
export async function GET() {
  const res = await requireTeacher(R.billingRead);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ count: registered }, { data: enr }, { data: att }, { data: paid }] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student"),
    admin.from("enrollments").select("student_id").eq("tenant_id", tid).eq("status", "active").limit(2000),
    admin.from("attendance").select("student_id").eq("tenant_id", tid).eq("status", "present").gte("created_at", weekAgo).limit(3000),
    admin.from("invoices").select("student_id").eq("tenant_id", tid).eq("status", "paid").limit(2000),
  ]);
  const stages = [
    { key: "registered", label: "طلاب مسجلون 👥", count: registered ?? 0 },
    { key: "active", label: "نشطون بمجموعات 📚", count: new Set(((enr ?? []) as any[]).map((e) => e.student_id)).size },
    { key: "attended", label: "حضروا هذا الأسبوع ✅", count: new Set(((att ?? []) as any[]).map((a) => a.student_id)).size },
    { key: "paid", label: "سددوا فواتير 💰", count: new Set(((paid ?? []) as any[]).map((p) => p.student_id)).size },
  ];
  let prev = stages[0]?.count ?? 0;
  const out = stages.map((s, i) => {
    const rate = i === 0 ? 100 : prev > 0 ? Math.round((s.count / prev) * 100) : 0;
    prev = s.count;
    return { ...s, rate };
  });
  return NextResponse.json({ ok: true, funnel: out });
}
