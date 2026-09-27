import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/tenant/health — درجة صحة السنتر 0-100 + إشارات (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: t }, { count: pay }, { count: att }, { count: ex }, { count: st }, { count: nps }, { count: tickets }] = await Promise.all([
    admin.from("tenants").select("plan,trial_ends_at,settings").eq("id", tid).single(),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", monthAgo),
    admin.from("attendance").select("id", { count: "exact", head: true }).eq("tenant_id", tid).gte("created_at", weekAgo),
    admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_published", true),
    admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student"),
    admin.from("feedback").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("kind", "nps").limit(1),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "open").eq("priority", "high"),
  ]);

  const paidUntil = (t as any)?.settings?.plan_paid_until as string | undefined;
  const isPaid = (t as any)?.plan !== "trial" && !!paidUntil && new Date(paidUntil).getTime() > Date.now();
  const trialActive = (t as any)?.plan === "trial" && (t as any)?.trial_ends_at && new Date((t as any).trial_ends_at).getTime() > Date.now();

  let score = 0;
  const signals: string[] = [];
  if (isPaid) { score += 30; signals.push("اشتراك مدفوع سارٍ ✅"); }
  else if (trialActive) { score += 15; signals.push("فترة تجريبية نشطة ⏳"); }
  else { signals.push("لا اشتراك سارٍ — جدد الآن 🔴"); }
  if ((pay ?? 0) > 0) { score += 20; signals.push(`تحصيل آخر 30 يوم: ${pay} دفعة ✅`); }
  else { signals.push("لا تحصيل منذ 30 يوماً 🔴"); }
  if ((att ?? 0) > 0) { score += 15; signals.push("تحضير نشط هذا الأسبوع ✅"); }
  else { signals.push("لا تحضير منذ أسبوع 🟡"); }
  if ((ex ?? 0) > 0) { score += 10; } else { signals.push("لا امتحانات منشورة 🟡"); }
  if ((st ?? 0) > 0) { score += 10; } else { signals.push("لا طلاب مسجلين 🔴"); }
  if ((nps ?? 0) > 0) { score += 5; }
  if ((tickets ?? 0) > 0) { score -= 10; signals.push(`${tickets} تذاكر حرجة مفتوحة 🔴`); }
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 80 ? "ممتازة 💪" : score >= 55 ? "جيدة 🙂" : score >= 30 ? "تحتاج انتباهاً 🟡" : "في خطر 🔴";
  return NextResponse.json({ ok: true, score, grade, signals: signals.slice(0, 6) });
}
