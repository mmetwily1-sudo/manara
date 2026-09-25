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
  const ageDays = (Date.now() - new Date((t as any)?.created_at ?? Date.now()).getTime()) / 864e5;
  if (ageDays < 14) return NextResponse.json({ ok: true, show: false, reason: "young" });
  const lastAsked = (t as any)?.settings?.nps_last_asked as string | undefined;
  if (lastAsked && (Date.now() - new Date(lastAsked).getTime()) / 864e5 < 90) {
    return NextResponse.json({ ok: true, show: false, reason: "recent" });
  }
  // نشاط ملموس: امتحان منشور أو 5+ طلاب أو تحصيل مؤكد
  const [{ count: ex }, { count: st }, { count: pay }] = await Promise.all([
    admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_published", true),
    admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student"),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "confirmed"),
  ]);
  if (!((ex ?? 0) > 0 || (st ?? 0) >= 5 || (pay ?? 0) > 0)) {
    return NextResponse.json({ ok: true, show: false, reason: "inactive" });
  }
  return NextResponse.json({ ok: true, show: true });
}
