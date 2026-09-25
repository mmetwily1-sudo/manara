import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/tenant/info — عدّاد التجربة للبانر (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const { data: t } = await admin.from("tenants").select("plan,trial_ends_at,settings")
    .eq("id", res.ctx.tenantId).single();
  const paidUntil = (t as any)?.settings?.plan_paid_until as string | undefined;
  if ((t as any)?.plan !== "trial" && paidUntil) {
    return NextResponse.json({ ok: true, trialState: "paid", trialDaysLeft: null, plan: (t as any).plan });
  }
  if (!(t as any)?.trial_ends_at) return NextResponse.json({ ok: true, trialState: "unknown", trialDaysLeft: null });
  const d = Math.ceil((new Date((t as any).trial_ends_at).getTime() - Date.now()) / 864e5);
  return NextResponse.json({
    ok: true, trialDaysLeft: d,
    trialState: d <= 0 ? "expired" : d <= 3 ? "expiring" : "active",
  });
}
