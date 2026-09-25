/** بناء تقرير ولي الأمر الأسبوعي لطالب: حضور + درجات + مستحق + نص واتساب جاهز */
export async function buildDigest(admin: any, tenantId: string, studentId: string, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const period = since.toISOString().slice(0, 10);

  const [{ data: stu }, { data: tenant }] = await Promise.all([
    admin.from("users").select("id,full_name,phone").eq("id", studentId).single(),
    admin.from("tenants").select("name").eq("id", tenantId).single(),
  ]);
  const centerName = (tenant as any)?.name ?? "";
  const studentName = (stu as any)?.full_name ?? "الطالب";

  // الحضور (آخر N يوم عبر الجلسات)
  let present = 0, absent = 0;
  try {
    const { data: att } = await admin.from("attendance").select("status,sessions!inner(session_date)")
      .eq("tenant_id", tenantId).eq("student_id", studentId)
      .gte("sessions.session_date", since.toISOString().slice(0, 10)).limit(100);
    (att ?? []).forEach((a: any) => {
      if (a.status === "present") present++;
      else if (a.status === "absent") absent++;
    });
  } catch {}

  // أحدث 3 نتائج (مع المجموع الكلي لكل امتحان)
  let exams: { title: string; score: number; total: number }[] = [];
  try {
    const { data: atts } = await admin.from("exam_attempts").select("score,exam_id,exams(title)")
      .eq("tenant_id", tenantId).eq("student_id", studentId)
      .order("submitted_at", { ascending: false }).limit(3);
    for (const a of (atts ?? []) as any[]) {
      let total = 0;
      if (a.exam_id) {
        const { data: eqs } = await admin.from("exam_questions").select("marks,questions(marks)")
          .eq("tenant_id", tenantId).eq("exam_id", a.exam_id).limit(200);
        total = (eqs ?? []).reduce((s: number, r: any) => s + Number(r.marks ?? r.questions?.marks ?? 0), 0);
      }
      exams.push({ title: a.exams?.title ?? "امتحان", score: Number(a.score ?? 0), total });
    }
  } catch {}

  // المستحق
  let due = 0;
  const periods: string[] = [];
  try {
    const { data: inv } = await admin.from("invoices").select("period,amount,paid,status")
      .eq("tenant_id", tenantId).eq("student_id", studentId).neq("status", "paid").limit(20);
    (inv ?? []).forEach((x: any) => {
      const rest = Number(x.amount ?? 0) - Number(x.paid ?? 0);
      if (rest > 0) { due += rest; periods.push(x.period); }
    });
  } catch {}

  const payload = { studentName, centerName, period, days, present, absent, exams, due, periods };
  const lines = [
    `تقرير ${centerName} الأسبوعي 📊`,
    `الطالب: ${studentName}`,
    `الحضور: ${present} حضور / ${absent} غياب`,
    ...exams.map((e) => `• ${e.title}: ${e.score}${e.total ? `/${e.total}` : ""}`),
    due > 0 ? `المستحق: ${due} جنيه (${periods.join("، ")})` : "لا مستحقات متأخرة ✅",
  ];
  return { ...payload, wa_text: lines.join("\n") };
}
