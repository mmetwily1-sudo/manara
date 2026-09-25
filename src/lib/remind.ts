/**
 * تذكير التحصيل التلقائي — قاعدة "بعد 3 أيام من الاستحقاق" (قرار اللجنة).
 * - يُذكَّر كل متأخر (unpaid/partial/overdue) لم يُذكَّر منذ 3+ أيام، بحد 3 تذكيرات إجمالاً.
 * - القناة: Web Push للمشتركين + واتساب إن كان مربوطاً (عبر notifyStudent).
 * - idempotent: dedupe_key يتضمن التاريخ، وlast_reminded_at يمنع التكرار.
 */

const GRACE_DAYS = 3;
const MAX_REMINDERS = 3;

export async function remindTenant(admin: any, tenantId: string) {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: inv } = await admin.from("invoices")
    .select("id,student_id,period,amount,paid,last_reminded_at,reminder_count,created_at")
    .eq("tenant_id", tenantId).neq("status", "paid").limit(300);
  const { data: trow } = await admin.from("tenants").select("name").eq("id", tenantId).single();
  const centerName = (trow as any)?.name ?? "";
  let reminded = 0, skipped = 0;

  // تجميع المتأخرات لكل طالب (رسالة واحدة بدل الإزعاج)
  const byStudent: Record<string, { due: number; periods: string[]; ids: string[] }> = {};
  for (const x of (inv ?? []) as any[]) {
    const rest = Number(x.amount ?? 0) - Number(x.paid ?? 0);
    if (rest <= 0) continue;
    if ((x.reminder_count ?? 0) >= MAX_REMINDERS) { skipped++; continue; }
    if (x.last_reminded_at && x.last_reminded_at >= cutoff) { skipped++; continue; }
    if (!x.last_reminded_at && (x.created_at ?? "") > cutoff) { skipped++; continue; } // أول تذكير بعد 3 أيام من الإصدار
    const b = (byStudent[x.student_id] ??= { due: 0, periods: [], ids: [] });
    b.due += rest;
    if (!b.periods.includes(x.period)) b.periods.push(x.period);
    b.ids.push(x.id);
  }

  const { notifyStudent } = await import("./notify");
  for (const [sid, b] of Object.entries(byStudent)) {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const r = await notifyStudent(admin, {
        tenantId, studentId: sid,
        event: { kind: "payment_reminder", studentName: "", amount: Math.round(b.due), centerName, periods: b.periods.join("، ") },
        dedupeKey: `remind:${sid}:${day}`,
      });
      void r;
      reminded++;
      const now = new Date().toISOString();
      for (const id of b.ids) {
        const { data: cur } = await admin.from("invoices").select("reminder_count").eq("id", id).single();
        await admin.from("invoices")
          .update({ last_reminded_at: now, reminder_count: Number((cur as any)?.reminder_count ?? 0) + 1 })
          .eq("id", id);
      }
    } catch { skipped++; }
  }
  return { reminded, skipped };
}
