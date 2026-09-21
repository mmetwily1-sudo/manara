/** محرك التحفيز — حسابات خالصة من البيانات (streak/أوسمة/نقاط). */

export type Trophy = { code: string; name: string; icon: string; desc: string };

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function streakOf(days: Set<string>): number {
  let s = 0;
  const cur = new Date();
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1); // اليوم لم يبدأ — ابدأ من أمس
  while (days.has(dayKey(cur))) { s++; cur.setDate(cur.getDate() - 1); }
  return s;
}

export function trophiesFor(o: {
  streak: number; activeDays: number; gradedCount: number; bestPct: number | null; presentRate: number | null;
}): Trophy[] {
  const t: Trophy[] = [];
  if (o.activeDays >= 1) t.push({ code: "first_steps", name: "البداية", icon: "🌱", desc: "أول يوم نشاط" });
  if (o.streak >= 3) t.push({ code: "persistent_3", name: "المثابر", icon: "🔥", desc: "3 أيام متتالية" });
  if (o.streak >= 7) t.push({ code: "persistent_7", name: "الشعلة", icon: "🔥🔥", desc: "7 أيام متتالية" });
  if (o.gradedCount >= 5) t.push({ code: "hardworker_5", name: "المجتهد", icon: "💪", desc: "5 واجبات مصححة" });
  if (o.bestPct !== null && o.bestPct >= 90) t.push({ code: "sharpshooter", name: "القناص", icon: "🎯", desc: "امتياز 90%+ في امتحان" });
  if (o.presentRate !== null && o.presentRate >= 90) t.push({ code: "punctual", name: "الملتزم", icon: "⏰", desc: "حضور 90%+" });
  return t;
}

export function pointsOf(activeDays: number, gradedCount: number, avgPct: number | null): number {
  return activeDays * 10 + gradedCount * 5 + (avgPct !== null ? Math.round(avgPct) : 0);
}

/** جدول النقاط الموحد — أي تغيير هنا ينعكس على كل المسارات */
export const POINTS = {
  present: 2, // حضور حصة
  submit: 5, // تسليم واجب (أول مرة فقط)
  examAttempt: 10, // تسليم امتحان (أول مرة لكل امتحان)
  gradeBonusMax: 5, // مكافأة التصحيح حسب النسبة (0..5)
} as const;

/** إضافة نقاط لدفتر الطالب — best-effort، لا تفشل العملية الأم أبداً */
export async function awardPoints(admin: any, tenantId: string, studentId: string, pts: number): Promise<void> {
  if (!pts || pts <= 0) return;
  try {
    const { data: u } = await admin.from("users").select("points").eq("id", studentId).eq("tenant_id", tenantId).single();
    const cur = Number((u as any)?.points ?? 0) || 0;
    await admin.from("users").update({ points: cur + pts }).eq("id", studentId).eq("tenant_id", tenantId);
  } catch {}
}
