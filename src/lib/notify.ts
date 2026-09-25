import { normalizePhone, sendWhatsAppText, isWhatsAppLive } from "./whatsapp";

/**
 * مركز الإشعارات — يسجل في notification_log ويرسل واتساب فوراً عند الإمكان.
 * - idempotent عبر dedupe_key (إعادة نفس الحدث لا ترسل مرتين)
 * - يحترم إيقاف السنتر: settings.notify_whatsapp === false
 * - الفشل في الإرسال لا يفشل العملية التشغيلية أبداً (best-effort + سجل)
 */

export type NotifyEvent =
  | { kind: "attendance_absent"; studentName: string; centerName: string; sessionLabel: string }
  | { kind: "exam_graded"; studentName: string; examTitle: string; score: number; total: number; certSerial: string | null }
  | { kind: "payment_received"; studentName: string; amount: number; centerName: string }
  | { kind: "homework_submitted"; studentName: string; hwTitle: string }
  | { kind: "homework_graded"; studentName: string; hwTitle: string; score: number; total: number };

function renderBody(e: NotifyEvent): string {
  switch (e.kind) {
    case "attendance_absent":
      return `تنبيه غياب من ${e.centerName} 📋\nالطالب: ${e.studentName}\nالحصة: ${e.sessionLabel}\nبرجاء التواصل مع الإدارة للاستفسار.`;
    case "exam_graded": {
      const pct = e.total > 0 ? Math.round((e.score / e.total) * 100) : 0;
      return `نتيجة امتحان 📝\n${e.studentName} حصل على ${e.score}/${e.total} (${pct}%) في «${e.examTitle}»${e.certSerial ? `\n🎓 شهادة إتمام: ${e.certSerial}` : ""}`;
    }
    case "payment_received":
      return `تم استلام دفعة ✅\nالطالب: ${e.studentName}\nالمبلغ: ${e.amount} جنيه\nشكراً لكم — ${e.centerName}`;
    case "homework_submitted":
      return `واجب جديد بانتظار التصحيح 📝\nالطالب: ${e.studentName}\nالواجب: «${e.hwTitle}»`;
    case "homework_graded": {
      const pct = e.total > 0 ? Math.round((e.score / e.total) * 100) : 0;
      return `تصحيح واجب 📝\n${e.studentName} حصل على ${e.score}/${e.total} (${pct}%) في «${e.hwTitle}»`;
    }
  }
}

export async function notifyStudent(
  admin: any,
  opts: {
    tenantId: string;
    studentId: string;
    event: NotifyEvent;
    dedupeKey: string;
  }
): Promise<{ sent: boolean; reason?: string }> {
  const { tenantId, studentId, event, dedupeKey } = opts;

  // idempotency أولاً
  const { data: dup } = await admin
    .from("notification_log")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .limit(1);
  if (dup?.length) return { sent: false, reason: "duplicate" };

  // بيانات الطالب + إعدادات السنتر
  const [{ data: student }, { data: tenant }] = await Promise.all([
    admin.from("users").select("id,full_name,phone").eq("id", studentId).single(),
    admin.from("tenants").select("settings").eq("id", tenantId).single(),
  ]);
  const phone = (student?.phone ?? "") as string;
  const enabled = (tenant?.settings as any)?.notify_whatsapp !== false;

  const body = renderBody({
    ...event,
    studentName: (event as any).studentName || student?.full_name || "الطالب",
  } as NotifyEvent);

  let status = "queued";
  let sentAt: string | null = null;
  let reason = "no_phone";
  let sent = false;

  const target = normalizePhone(phone);
  if (!enabled) {
    reason = "disabled_by_tenant";
  } else if (!target) {
    reason = "bad_phone";
  } else if (!isWhatsAppLive()) {
    reason = "not_configured";
  } else {
    const r = await sendWhatsAppText(target, body);
    if (r.ok) {
      status = "sent";
      sentAt = new Date().toISOString();
      sent = true;
    } else {
      status = "failed";
      reason = r.reason;
    }
  }

  await admin.from("notification_log").insert({
    tenant_id: tenantId,
    user_id: studentId,
    event: event.kind,
    channel: "whatsapp",
    payload: { body, reason },
    status,
    dedupe_key: dedupeKey,
    sent_at: sentAt,
  });

  // Web Push لأجهزة الطالب/ولي الأمر (best-effort — يصل حتى والتطبيق مقفول)
  try {
    const { sendPushToUser } = await import("./push");
    const titles: Record<NotifyEvent["kind"], string> = {
      attendance_absent: "تنبيه غياب 📋",
      exam_graded: "نتيجة امتحان 📝",
      payment_received: "تم استلام دفعة ✅",
      homework_submitted: "واجب جديد 📝",
      homework_graded: "تصحيح واجب 📝",
    };
    const r = await sendPushToUser(admin, tenantId, studentId, {
      title: titles[event.kind],
      body: body.slice(0, 150),
      url: "/progress",
    });
    if (r.sent > 0 || r.cleaned > 0) {
      await admin.from("notification_log").insert({
        tenant_id: tenantId, user_id: studentId, event: event.kind, channel: "webpush",
        payload: { sent: r.sent, cleaned: r.cleaned }, status: r.sent > 0 ? "sent" : "queued",
        dedupe_key: dedupeKey + ":push", sent_at: r.sent > 0 ? new Date().toISOString() : null,
      });
    }
  } catch {}

  return { sent, reason: sent ? undefined : reason };
}
