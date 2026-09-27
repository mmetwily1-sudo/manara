import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/reports/narrative — تقرير شهري مكتوب بلغة بشرية من الأرقام (قواعد صريحة، بلا هلوسة) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: t }, { data: pay }, { data: groups }, { data: enr }, { data: att }, { data: inv }] = await Promise.all([
    admin.from("tenants").select("name").eq("id", tid).single(),
    admin.from("payments").select("amount,paid_at").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", monthAgo).limit(3000),
    admin.from("groups").select("id,name,monthly_fee").eq("tenant_id", tid).limit(200),
    admin.from("enrollments").select("group_id,student_id").eq("tenant_id", tid).eq("status", "active").limit(3000),
    admin.from("attendance").select("student_id,status").eq("tenant_id", tid).gte("created_at", weekAgo).limit(5000),
    admin.from("invoices").select("amount,paid").eq("tenant_id", tid).neq("status", "paid").limit(2000),
  ]);
  const collected = ((pay ?? []) as any[]).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const students = new Set(((enr ?? []) as any[]).map((e) => e.student_id)).size;
  const sessions = (att ?? []).length;
  const present = ((att ?? []) as any[]).filter((a) => a.status === "present").length;
  const rate = sessions ? Math.round((present / sessions) * 100) : 0;
  const overdue = ((inv ?? []) as any[]).reduce((s, x) => s + Math.max(0, Number(x.amount ?? 0) - Number(x.paid ?? 0)), 0);
  const center = (t as any)?.name ?? "سنترك";

  // أنشط مجموعة تحصيلاً
  const { data: payG } = await admin.from("payments").select("amount,group_id")
    .eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", monthAgo).limit(3000);
  const byG: Record<string, number> = {};
  ((payG ?? []) as any[]).forEach((p) => { if (p.group_id) byG[p.group_id] = (byG[p.group_id] ?? 0) + Number(p.amount ?? 0); });
  const topGid = Object.entries(byG).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topG = ((groups ?? []) as any[]).find((g) => g.id === topGid);

  const paras: string[] = [];
  paras.push(`خلال آخر 30 يوماً حصّل ${center} مبلغ ${collected.toLocaleString("ar-EG")} جنيه من ${students} طالباً نشطاً عبر ${(groups ?? []).length} مجموعات.`);
  paras.push(rate >= 85 ? `الالتزام ممتاز: نسبة الحضور ${rate}% هذا الأسبوع — حافظ على هذا الزخم.` :
    rate >= 60 ? `الحضور متوسط (${rate}%) — راجع قوائم الغياب المتكرر قبل أن يتحول لتسرب.` :
    `الحضور منخفض (${rate}%) — تدخّل فوري مطلوب: راجع الإنذار المبكر وتواصل مع أولياء الأمور.`);
  if (topG) paras.push(`أعلى المجموعات تحصيلاً: «${topG.name}» — ادرس ما يميزها وكرره في باقي المجموعات.`);
  paras.push(overdue > 0 ? `المتأخرات القائمة ${overdue.toLocaleString("ar-EG")} جنيه — ابدأ بالأعلى أولوية من صفحة التحصيل.` : `لا متأخرات قائمة — تحصيل نظيف ✅`);
  return NextResponse.json({ ok: true, paras });
}
