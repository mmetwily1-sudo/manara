import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/**
 * GET /api/me/progress — تقدم الطالب الحالي في مكان واحد:
 * نتائج الامتحانات + الشهادات + مجموعاته + فيديوهاته المتاحة.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = adminClient();
  const { data: urow } = await admin
    .from("users")
    .select("id,tenant_id,role,full_name")
    .eq("auth_user_id", user.id)
    .single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: attempts }, { data: certs }, { data: enrolls }, { data: videos }, { data: pays }, { data: tenant }] = await Promise.all([
    admin
      .from("exam_attempts")
      .select("id,score,submitted_at,exam_id,exams(title,total_marks)")
      .eq("tenant_id", tid)
      .eq("student_id", sid)
      .order("submitted_at", { ascending: false })
      .limit(50),
    admin
      .from("certificates")
      .select("serial_code,title,score,created_at")
      .eq("tenant_id", tid)
      .eq("student_id", sid)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("enrollments")
      .select("group_id,special_price,groups(name,subject,monthly_fee)")
      .eq("tenant_id", tid)
      .eq("student_id", sid)
      .eq("status", "active"),
    admin
      .from("videos")
      .select("id,title,visibility,created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("payments")
      .select("amount,status,paid_at")
      .eq("tenant_id", tid)
      .eq("student_id", sid)
      .gte("paid_at", monthStart.toISOString()),
    admin.from("tenants").select("settings").eq("id", tid).single(),
  ]);

  const paid = (pays ?? []).filter((p: any) => p.status === "confirmed").reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const expected = (enrolls ?? []).reduce((s: number, e: any) => s + Number((e as any).special_price ?? (e as any).groups?.monthly_fee ?? 0), 0);

  const avg =
    attempts?.length
      ? Math.round(attempts.reduce((s: number, a: any) => s + Number(a.score ?? 0), 0) / attempts.length)
      : null;

  return NextResponse.json({
    ok: true,
    student: { name: (urow as any).full_name },
    billing: {
      paid,
      expected,
      outstanding: Math.max(0, expected - paid),
      pay_numbers: ((tenant as any)?.settings?.pay_numbers ?? {}) as Record<string, string>,
    },
    stats: { exams_taken: attempts?.length ?? 0, avg_score: avg, certificates: certs?.length ?? 0 },
    attempts: (attempts ?? []).map((a: any) => ({
      id: a.id,
      exam_title: a.exams?.title ?? "امتحان",
      score: Number(a.score ?? 0),
      total: Number(a.exams?.total_marks ?? 0),
      submitted_at: a.submitted_at,
    })),
    certificates: certs ?? [],
    groups: (enrolls ?? []).map((e: any) => ({ id: e.group_id, name: e.groups?.name ?? "مجموعة", subject: e.groups?.subject ?? null })),
    videos: (videos ?? []).map((v: any) => ({ id: v.id, title: v.title, visibility: v.visibility })),
  });
}
