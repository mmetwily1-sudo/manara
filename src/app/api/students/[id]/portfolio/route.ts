import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/students/[id]/portfolio — ملف إنجاز الطالب: نقاط/حضور/متوسط/شهادات/أهداف */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const sid = params.id;

  const { data: st } = await admin.from("users").select("id,full_name,phone,points,created_at")
    .eq("id", sid).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ count: present }, { count: absent }, { data: atts }, { data: goals }, { data: groups }] = await Promise.all([
    admin.from("attendance").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("student_id", sid).eq("status", "present").gte("created_at", monthAgo),
    admin.from("attendance").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("student_id", sid).eq("status", "absent").gte("created_at", monthAgo),
    admin.from("exam_attempts").select("id,score,exam_id,submitted_at,exams(title)").eq("tenant_id", tid).eq("student_id", sid).order("submitted_at", { ascending: false }).limit(10),
    admin.from("student_goals").select("id,title,status").eq("tenant_id", tid).eq("student_id", sid).limit(20),
    admin.from("enrollments").select("groups(name)").eq("tenant_id", tid).eq("student_id", sid).eq("status", "active").limit(20),
  ]);
  const attIds = ((atts ?? []) as any[]).map((a) => a.id);
  let certs: any[] = [];
  if (attIds.length) {
    const { data } = await admin.from("certificates").select("id,title,serial_code,issued_at")
      .eq("tenant_id", tid).in("attempt_id", attIds).order("issued_at", { ascending: false }).limit(20);
    certs = (data ?? []) as any[];
  }
  // متوسط آخر 5 محاولات بالنسب
  let sum = 0, n = 0;
  for (const a of ((atts ?? []) as any[]).slice(0, 5)) {
    const { data: qs } = await admin.from("exam_questions").select("marks").eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(200);
    const total = ((qs ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 0), 0);
    if (total > 0) { sum += (Number(a.score ?? 0) / total) * 100; n++; }
  }
  return NextResponse.json({
    ok: true,
    portfolio: {
      name: (st as any).full_name, phone: (st as any).phone,
      points: Number((st as any).points ?? 0) || 0,
      present30: present ?? 0, absent30: absent ?? 0, avg5: n ? Math.round(sum / n) : null,
      groups: ((groups ?? []) as any[]).map((g) => (g.groups as any)?.name).filter(Boolean),
      attempts: ((atts ?? []) as any[]).map((a) => ({ exam: (a.exams as any)?.title ?? "امتحان", score: a.score, at: String(a.submitted_at ?? "").slice(0, 10) })),
      certificates: certs ?? [],
      goals: ((goals ?? []) as any[]).map((g) => ({ title: g.title, status: g.status })),
    },
  });
}
