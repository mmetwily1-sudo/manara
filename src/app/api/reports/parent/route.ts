import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/reports/parent?studentId= — بيانات تقرير ولي الأمر الشهري (آخر 30 يوم) */
export async function GET(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const studentId = new URL(req.url).searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ ok: false, error: "missing_student" }, { status: 400 });

  const { data: student } = await admin
    .from("users")
    .select("id,full_name,phone")
    .eq("id", studentId)
    .eq("tenant_id", tid)
    .eq("role", "student")
    .single();
  if (!student) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: att }, { data: attempts }, { data: pays }, { data: enrolls }, { data: tenant }] = await Promise.all([
    admin
      .from("attendance")
      .select("status,sessions!inner(session_date)")
      .eq("tenant_id", tid)
      .eq("student_id", studentId)
      .gte("sessions.session_date", since.slice(0, 10)),
    admin
      .from("exam_attempts")
      .select("score,submitted_at,exams(title)")
      .eq("tenant_id", tid)
      .eq("student_id", studentId)
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: false })
      .limit(20),
    admin
      .from("payments")
      .select("amount,status,paid_at")
      .eq("tenant_id", tid)
      .eq("student_id", studentId)
      .gte("paid_at", monthStart.toISOString()),
    admin
      .from("enrollments")
      .select("special_price,groups(monthly_fee)")
      .eq("tenant_id", tid)
      .eq("student_id", studentId)
      .eq("status", "active"),
    admin.from("tenants").select("name").eq("id", tid).single(),
  ]);

  const present = (att ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
  const total = (att ?? []).length;
  const paid = (pays ?? []).filter((p: any) => p.status === "confirmed").reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const expected = (enrolls ?? []).reduce((s: number, e: any) => s + Number(e.special_price ?? e.groups?.monthly_fee ?? 0), 0);
  const scores = (attempts ?? []).map((a: any) => Number(a.score ?? 0));
  const avg = scores.length ? Math.round(scores.reduce((s: number, x: number) => s + x, 0) / scores.length) : null;

  return NextResponse.json({
    ok: true,
    report: {
      center: (tenant as any)?.name ?? "",
      student: { name: (student as any).full_name, phone: (student as any).phone },
      period: { from: since.slice(0, 10), to: new Date().toISOString().slice(0, 10) },
      attendance: { present, total, pct: total ? Math.round((present / total) * 100) : null },
      exams: {
        count: attempts?.length ?? 0,
        avg_score: avg,
        list: (attempts ?? []).map((a: any) => ({ title: a.exams?.title ?? "امتحان", score: Number(a.score ?? 0), date: a.submitted_at?.slice(0, 10) })),
      },
      payments: { paid, expected, outstanding: Math.max(0, expected - paid) },
    },
  });
}
