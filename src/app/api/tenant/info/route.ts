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
  const renewalState = String((t as any)?.settings?.renewal_state ?? "active");
  const renewalExtra = (renewalState === "grace" || renewalState === "suspended" || renewalState === "due_soon")
    ? { renewal_state: renewalState } : {};
  if ((t as any)?.plan !== "trial" && paidUntil) {
    const pd = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 864e5);
    return NextResponse.json({ ok: true, trialState: "paid", trialDaysLeft: pd, plan: (t as any).plan, ...renewalExtra });
  }
  if (!(t as any)?.trial_ends_at) return NextResponse.json({ ok: true, trialState: "unknown", trialDaysLeft: null });
  const d = Math.ceil((new Date((t as any).trial_ends_at).getTime() - Date.now()) / 864e5);
  return NextResponse.json({
    ok: true, trialDaysLeft: d,
    trialState: d <= 0 ? "expired" : d <= 3 ? "expiring" : "active",
    canExtend: d <= 0 && !(t as any)?.settings?.trial_extended,
  });
}
