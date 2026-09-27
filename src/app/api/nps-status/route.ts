import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/**
 * GET /api/nps-status — هل نعرض حملة NPS؟ (مرة بعد 14 يوم نشاط + كل 90 يوماً كحد أقصى)
 * القواعد (إجماع اللجنة): نشط فقط + بعد نجاح ملموس + عند فتح اللوحة لا أثناء العمل.
 */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const { data: t } = await admin.from("tenants").select("created_at,settings").eq("id", tid).single();
  const lastAsked = (t as any)?.settings?.nps_last_asked as string | undefined;
  if (lastAsked && (Date.now() - new Date(lastAsked).getTime()) / 864e5 < 90) {
    return NextResponse.json({ ok: true, show: false, reason: "recent" });
  }
  // نجاح ملموس: امتحان منشور أو 3+ تحصيلات مؤكدة
  const [{ count: ex }, { count: pay }] = await Promise.all([
    admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_published", true),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "confirmed"),
  ]);
  const firstSuccess = (ex ?? 0) > 0 || (pay ?? 0) >= 3;
  // أول نجاح ملموس → اسأل فوراً حتى قبل 14 يوماً (قرار الجولة 23)
  if (firstSuccess && !lastAsked) return NextResponse.json({ ok: true, show: true, reason: "first_success" });
  const ageDays = (Date.now() - new Date((t as any)?.created_at ?? Date.now()).getTime()) / 864e5;
  if (ageDays < 14) return NextResponse.json({ ok: true, show: false, reason: "young" });
  const { count: st } = await admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student");
  if (!(firstSuccess || (st ?? 0) >= 5)) {
    return NextResponse.json({ ok: true, show: false, reason: "inactive" });
  }
  return NextResponse.json({ ok: true, show: true });
}
