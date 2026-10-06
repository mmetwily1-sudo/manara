/**
 * محرك التنبؤ الوطني — يجمّع إحصاءات صعوبة الأسئلة عبر كل المنصة
 * (كل السناتر معاً) لإنتاج رؤية لا يقدر سنتر واحد يبنيها ببياناته وحده.
 *
 * مهم: الناتج مُجمَّع بالكامل (subject+lesson+difficulty) — لا يُخزَّن ولا
 * يُستخرج أي tenant_id أو student_id في أي خطوة. هذا ليس حذفاً لاحقاً
 * للخصوصية، الاستعلام نفسه لا يجلب هذه الأعمدة من الأساس.
 */

type Bucket = { subject: string; lesson: string; difficulty: number; wrong: number; total: number; seconds: number[]; tenants: Set<string> };

export async function recomputeNationalStats(admin: any): Promise<{ buckets: number; samples: number }> {
  // نافذة متحركة: آخر 90 يوماً فقط — يعكس صعوبة المنهج الحالي لا أرشيفاً قديماً
  const since = new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: attempts } = await admin
    .from("exam_attempts")
    .select("tenant_id,answers,started_at,submitted_at")
    .not("submitted_at", "is", null)
    .gte("submitted_at", since)
    .limit(20000); // حد أعلى دفاعي — يمنع استعلاماً عملاقاً يكسر مهلة الدالة

  if (!attempts?.length) return { buckets: 0, samples: 0 };

  const qids = new Set<string>();
  for (const a of attempts as any[]) Object.keys(a.answers ?? {}).forEach((k) => qids.add(k));

  const { data: questions } = await admin
    .from("questions")
    .select("id,subject,lesson,difficulty,qtype,correct_answer")
    .in("id", Array.from(qids))
    .limit(20000);
  const qMap = new Map<string, any>((questions ?? []).map((q: any) => [q.id, q]));

  const buckets = new Map<string, Bucket>();
  for (const att of attempts as any[]) {
    const durationTotal = att.submitted_at && att.started_at
      ? (new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime()) / 1000 : null;
    const answerEntries = Object.entries(att.answers ?? {});
    const perQSeconds = durationTotal && answerEntries.length ? durationTotal / answerEntries.length : null;

    for (const [qid, given] of answerEntries) {
      const q = qMap.get(qid);
      if (!q || !q.lesson || (q.qtype !== "mcq" && q.qtype !== "true_false")) continue;
      const key = `${q.subject}|||${q.lesson}|||${q.difficulty}`;
      const b = buckets.get(key) ?? { subject: q.subject ?? "", lesson: q.lesson, difficulty: q.difficulty, wrong: 0, total: 0, seconds: [] as number[], tenants: new Set<string>() };
      b.total++;
      if (JSON.stringify(given) !== JSON.stringify(q.correct_answer)) b.wrong++;
      if (perQSeconds) b.seconds.push(perQSeconds);
      b.tenants.add(att.tenant_id); // يُستخدم فقط للعدّ (contributing_tenants) ثم يُهمَل — لا يُخزَّن
      buckets.set(key, b);
    }
  }

  let written = 0;
  const jobs: Bucket[] = [];
  buckets.forEach((b) => { jobs.push(b); });
  for (const b of jobs) {
    if (b.total < 10) continue; // عتبة ثقة دنيا — يمنع نشر رقم من عينة ضعيفة
    const avgSeconds = b.seconds.length ? b.seconds.reduce((a: number, c: number) => a + c, 0) / b.seconds.length : null;
    await admin.from("question_national_stats").upsert({
      subject: b.subject, lesson: b.lesson, difficulty: b.difficulty,
      sample_size: b.total, avg_error_rate: b.wrong / b.total,
      avg_seconds_per_question: avgSeconds, contributing_tenants: b.tenants.size,
      updated_at: new Date().toISOString(),
    }, { onConflict: "subject,lesson,difficulty" });
    written++;
  }
  return { buckets: written, samples: attempts.length };
}
