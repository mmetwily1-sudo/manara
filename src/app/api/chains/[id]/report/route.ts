import { NextResponse } from "next/server";
import { requireChainAdmin } from "@/lib/server-auth";

/**
 * GET /api/chains/[id]/report — تقرير مجمّع عبر كل فروع السلسلة.
 * القيمة التجارية الفعلية لوضع السلسلة: رؤية موحدة بدل الدخول فرعاً فرعاً.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireChainAdmin(params.id);
  if ("error" in res) return res.error;
  const { admin, tenantIds } = res.ctx;

  if (tenantIds.length === 0) {
    return NextResponse.json({ ok: true, branches: [], totals: { students: 0, revenue_month: 0, active_branches: 0 } });
  }

  const [{ data: tenants }, { data: students }, { data: payments }] = await Promise.all([
    admin.from("tenants").select("id,name,status,plan").in("id", tenantIds),
    admin.from("users").select("id,tenant_id").eq("role", "student").in("tenant_id", tenantIds),
    admin.from("payments").select("tenant_id,amount,paid_at").eq("status", "confirmed").in("tenant_id", tenantIds)
      .gte("paid_at", new Date(new Date().setDate(1)).toISOString()), // بداية الشهر الحالي
  ]);

  const studentsByTenant = new Map<string, number>();
  for (const s of (students ?? []) as any[]) studentsByTenant.set(s.tenant_id, (studentsByTenant.get(s.tenant_id) ?? 0) + 1);

  const revenueByTenant = new Map<string, number>();
  for (const p of (payments ?? []) as any[]) revenueByTenant.set(p.tenant_id, (revenueByTenant.get(p.tenant_id) ?? 0) + Number(p.amount ?? 0));

  const branches = ((tenants ?? []) as any[]).map((t) => ({
    id: t.id, name: t.name, status: t.status, plan: t.plan,
    students: studentsByTenant.get(t.id) ?? 0,
    revenue_month: revenueByTenant.get(t.id) ?? 0,
  })).sort((a, b) => b.revenue_month - a.revenue_month);

  const totals = {
    students: branches.reduce((s, b) => s + b.students, 0),
    revenue_month: branches.reduce((s, b) => s + b.revenue_month, 0),
    active_branches: branches.filter((b) => b.status === "active").length,
  };

  return NextResponse.json({ ok: true, branches, totals });
}
