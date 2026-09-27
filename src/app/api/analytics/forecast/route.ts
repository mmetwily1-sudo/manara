import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/analytics/forecast — تنبؤ الشهر القادم (تحصيل + تسرب) من المتوسطات — مالك */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  // تحصيل آخر 3 أشهر كاملة
  const months: { key: string; total: number }[] = [];
  const now = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = d.toISOString().slice(0, 10);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
    const { data } = await admin.from("payments").select("amount")
      .eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", from).lt("paid_at", to).limit(3000);
    months.push({ key: from.slice(0, 7), total: ((data ?? []) as any[]).reduce((s, p) => s + Number(p.amount ?? 0), 0) });
  }
  const avg = months.length ? Math.round(months.reduce((s, m) => s + m.total, 0) / months.length) : 0;

  // متأخرات قابلة للتحصيل (تقدير متحفظ 40%)
  const { data: inv } = await admin.from("invoices").select("amount,paid")
    .eq("tenant_id", tid).neq("status", "paid").limit(2000);
  const overdue = ((inv ?? []) as any[]).reduce((s, x) => s + Math.max(0, Number(x.amount ?? 0) - Number(x.paid ?? 0)), 0);
  const collectible = Math.round(overdue * 0.4);

  // إشارات تسرب: طلاب بلا حضور 14 يوماً + تجارب تنتهي خلال 7 أيام
  const cutoff = new Date(Date.now() - 14 * 864e5).toISOString();
  const [{ data: students }, { data: recent }] = await Promise.all([
    admin.from("users").select("id").eq("tenant_id", tid).eq("role", "student").limit(2000),
    admin.from("attendance").select("student_id").eq("tenant_id", tid).gte("created_at", cutoff).limit(5000),
  ]);
  const seen = new Set(((recent ?? []) as any[]).map((a) => a.student_id));
  const inactive = ((students ?? []) as any[]).filter((s) => !seen.has(s.id)).length;

  return NextResponse.json({
    ok: true,
    collection: { monthlyAvg: avg, overdue, collectible, forecast: avg + collectible, history: months },
    churn: { inactive14d: inactive, total: (students ?? []).length },
  });
}
