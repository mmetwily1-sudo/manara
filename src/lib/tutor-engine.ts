/**
 * محرك المدرّس الذكي — النسخة الأولى: إحصائي بالكامل (بلا LLM خارجي).
 * يُعاد حسابه دورياً عبر job خلفي (bg_jobs kind="tutor_recompute") لا لحظياً،
 * لتفادي حمل إضافي وقت تسليم الامتحان.
 *
 * لماذا إحصائي أولاً؟ لأن التوصية الموثوقة ("ضعيف في الكسور") تحتاج بيانات
 * حقيقية كافية لكل طالب قبل ما نسمح لـLLM يخترع تفسيراً. المرحلة التالية
 * (بعد تراكم بيانات) تستبدل هذه الدالة باستدعاء نموذج فعلي، بنفس التوقيع.
 */

export type WeakTopic = { lesson: string; subject: string; wrongCount: number; totalCount: number; errorRate: number };

type GradableQuestion = {
  id: string;
  subject: string | null;
  lesson: string | null;
  qtype: string;
  correct_answer: unknown;
};

/** هل إجابة الطالب لسؤال MCQ/صح-خطأ صحيحة؟ الأنواع المقالية غير قابلة للحكم الآلي هنا */
function isAutoGradable(qtype: string): boolean {
  return qtype === "mcq" || qtype === "true_false";
}

function answersMatch(given: unknown, correct: unknown): boolean {
  if (given == null) return false;
  return JSON.stringify(given) === JSON.stringify(correct);
}

export function computeWeakTopics(
  attempts: { answers: Record<string, unknown>; submitted_at: string | null }[],
  questionsById: Map<string, GradableQuestion>
): WeakTopic[] {
  const byTopic = new Map<string, { subject: string; wrong: number; total: number }>();
  for (const att of attempts) {
    if (!att.submitted_at) continue;
    for (const [qid, given] of Object.entries(att.answers ?? {})) {
      const q = questionsById.get(qid);
      if (!q || !isAutoGradable(q.qtype) || !q.lesson) continue;
      const key = q.lesson;
      const bucket = byTopic.get(key) ?? { subject: q.subject ?? "", wrong: 0, total: 0 };
      bucket.total++;
      if (!answersMatch(given, q.correct_answer)) bucket.wrong++;
      byTopic.set(key, bucket);
    }
  }
  const out: WeakTopic[] = [];
  byTopic.forEach((b, lesson) => {
    if (b.total < 3) return; // بيانات غير كافية للحكم — يمنع توصية كاذبة من سؤال واحد
    const errorRate = b.wrong / b.total;
    if (errorRate >= 0.4) out.push({ lesson, subject: b.subject, wrongCount: b.wrong, totalCount: b.total, errorRate });
  });
  return out.sort((a, b) => b.errorRate - a.errorRate).slice(0, 5);
}

/** اتجاه الأداء من آخر 5 درجات مُطبَّعة (score/total) — انحدار خطي بسيط */
export function computeTrend(scoresNewestFirst: number[]): "up" | "flat" | "down" {
  const s = scoresNewestFirst.slice(0, 5).reverse(); // الأقدم أولاً للانحدار
  if (s.length < 3) return "flat";
  const n = s.length;
  const xMean = (n - 1) / 2;
  const yMean = s.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  s.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope = den === 0 ? 0 : num / den;
  if (slope > 0.03) return "up";
  if (slope < -0.03) return "down";
  return "flat";
}

export function buildRecommendations(
  studentId: string,
  tenantId: string,
  weakTopics: WeakTopic[],
  trend: "up" | "flat" | "down",
  avgSecondsPerQuestion: number | null,
  priorAvgSeconds: number | null
): { tenant_id: string; student_id: string; kind: string; subject: string | null; topic: string | null; message: string; priority: number }[] {
  const recs: ReturnType<typeof buildRecommendations> = [];
  for (const w of weakTopics.slice(0, 3)) {
    recs.push({
      tenant_id: tenantId, student_id: studentId, kind: "review_topic",
      subject: w.subject || null, topic: w.lesson,
      message: `راجع درس "${w.lesson}" — أخطأت في ${w.wrongCount} من ${w.totalCount} سؤال فيه مؤخراً.`,
      priority: w.errorRate >= 0.6 ? 1 : 2,
    });
  }
  if (trend === "down") {
    recs.push({
      tenant_id: tenantId, student_id: studentId, kind: "at_risk_alert",
      subject: null, topic: null,
      message: "درجاتك في آخر امتحانات في تراجع ملحوظ — ممكن تحتاج مراجعة مع المدرّس.",
      priority: 1,
    });
  } else if (trend === "up" && weakTopics.length === 0) {
    recs.push({
      tenant_id: tenantId, student_id: studentId, kind: "celebrate_streak",
      subject: null, topic: null,
      message: "أداؤك في تحسّن مستمر — استمر على نفس الوتيرة! 🎉",
      priority: 3,
    });
  }
  if (avgSecondsPerQuestion && priorAvgSeconds && avgSecondsPerQuestion > priorAvgSeconds * 1.5) {
    recs.push({
      tenant_id: tenantId, student_id: studentId, kind: "slow_down",
      subject: null, topic: null,
      message: "لاحظنا إنك بتاخد وقت أطول من المعتاد في حل الأسئلة — خد وقتك، بس لو فيه حاجة مش واضحة اسأل المدرّس.",
      priority: 3,
    });
  }
  return recs;
}

/**
 * يعيد حساب ملف تعلّم وتوصيات طالب واحد ويكتبهم في قاعدة البيانات.
 * يُستدعى من job خلفي (tutor_recompute) أو مباشرة من API إداري لطالب واحد.
 */
export async function recomputeStudentProfile(admin: any, tenantId: string, studentId: string): Promise<boolean> {
  const { data: attempts } = await admin
    .from("exam_attempts")
    .select("id,answers,score,started_at,submitted_at")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(20);
  if (!attempts?.length) return true; // لا بيانات بعد — طبيعي لطالب جديد

  const allQids = new Set<string>();
  for (const a of attempts) Object.keys((a as any).answers ?? {}).forEach((k) => allQids.add(k));
  const { data: questions } = await admin
    .from("questions")
    .select("id,subject,lesson,qtype,correct_answer")
    .eq("tenant_id", tenantId)
    .in("id", Array.from(allQids));
  const qMap = new Map<string, GradableQuestion>((questions ?? []).map((q: any) => [q.id, q]));

  const weakTopics = computeWeakTopics(attempts as any, qMap);

  // متوسط الوقت: started_at → submitted_at ÷ عدد الأسئلة المجاب عنها
  const durations = (attempts as any[]).map((a) => {
    const qCount = Object.keys(a.answers ?? {}).length || 1;
    const secs = (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000;
    return secs > 0 ? secs / qCount : null;
  }).filter((x): x is number => x != null);
  const avgSeconds = durations.length ? durations.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(5, durations.length) : null;
  const priorAvgSeconds = durations.length > 5 ? durations.slice(5, 10).reduce((a, b) => a + b, 0) / Math.min(5, durations.length - 5) : null;

  const normScores = (attempts as any[]).map((a) => (typeof a.score === "number" ? a.score : null)).filter((x): x is number => x != null);
  const trend = computeTrend(normScores);

  const subject = (questions ?? [])[0]?.subject ?? null;
  await admin.from("student_learning_profile").upsert({
    tenant_id: tenantId, student_id: studentId, subject,
    weak_topics: weakTopics, avg_seconds_per_question: avgSeconds, trend,
    last_computed_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,student_id,subject" });

  // نظّف التوصيات القديمة غير المرفوضة قبل كتابة الجديدة (لا تراكم بلا نهاية)
  await admin.from("student_recommendations").delete()
    .eq("tenant_id", tenantId).eq("student_id", studentId).is("dismissed_at", null);
  const recs = buildRecommendations(studentId, tenantId, weakTopics, trend, avgSeconds, priorAvgSeconds);
  if (recs.length) await admin.from("student_recommendations").insert(recs);

  return true;
}
