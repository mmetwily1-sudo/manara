import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/analytics/pricing-hints — اقتراحات تسعير من البيانات (قواعد صريحة): امتلاء+تحصيل كامل=ارفع؛ تحصيل ضعيف=راجع */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: groups }, { data: enr }, { data: pay }] = await Promise.all([
    admin.from("groups").select("id,name,monthly_fee").eq("tenant_id", tid).limit(200),
    admin.from("enrollments").select("group_id,student_id").eq("tenant_id", tid).eq("status", "active").limit(3000),
    admin.from("payments").select("amount,group_id").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", monthAgo).limit(3000),
  ]);
  const hints: { group: string; hint: string; tone: string }[] = [];
  for (const g of (groups ?? []) as any[]) {
    const n = new Set(((enr ?? []) as any[]).filter((e) => e.group_id === g.id).map((e) => e.student_id)).size;
    const fee = Number(g.monthly_fee ?? 0);
    if (!fee || !n) continue;
    const col = ((pay ?? []) as any[]).filter((p) => p.group_id === g.id).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const rate = col / (fee * n);
    if (n >= 20 && rate >= 0.95) {
      hints.push({ group: g.name, hint: `طلب مرتفع وتحصيل كامل — ارفع الرسوم 10-15% للدفعة القادمة (+${Math.round(fee * n * 0.12).toLocaleString("ar-EG")} ج/شهر متوقع)`, tone: "up" });
    } else if (rate < 0.5) {
      hints.push({ group: g.name, hint: `تحصيل ${Math.round(rate * 100)}% فقط — راجع السعر أو أطلق خصم تسجيل مبكر بدل الرفع`, tone: "down" });
    }
  }
  return NextResponse.json({ ok: true, hints: hints.slice(0, 20) });
}
