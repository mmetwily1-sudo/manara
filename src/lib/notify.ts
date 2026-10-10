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
  | { kind: "payment_received"; studentName: string; amount: number; centerName: string; receiptNo?: number | null }
  | { kind: "payment_reminder"; studentName: string; amount: number; centerName: string; periods: string }
  | { kind: "homework_submitted"; studentName: string; hwTitle: string }
  | { kind: "homework_graded"; studentName: string; hwTitle: string; score: number; total: number }
  | { kind: "digest_weekly"; studentName: string; centerName: string; text: string };

function renderBody(e: NotifyEvent): string {
  switch (e.kind) {
    case "attendance_absent":
      return `تنبيه غياب من ${e.centerName} 📋\nالطالب: ${e.studentName}\nالحصة: ${e.sessionLabel}\nبرجاء التواصل مع الإدارة للاستفسار.`;
    case "exam_graded": {
      const pct = e.total > 0 ? Math.round((e.score / e.total) * 100) : 0;
      return `نتيجة امتحان 📝\n${e.studentName} حصل على ${e.score}/${e.total} (${pct}%) في «${e.examTitle}»${e.certSerial ? `\n🎓 شهادة إتمام: ${e.certSerial}` : ""}`;
    }
    case "payment_received":
      return `تم استلام دفعة ✅\nالطالب: ${e.studentName}\nالمبلغ: ${e.amount} جنيه${e.receiptNo ? `\nإيصال رقم: #${e.receiptNo}` : ""}\nشكراً لكم — ${e.centerName}`;
    case "payment_reminder":
      return `تذكير ودي بالمصروفات 🔔\nالطالب: ${e.studentName}\nالمستحق: ${e.amount} جنيه (${e.periods})\n${e.centerName} — للسداد تواصل مع الإدارة.`;
    case "homework_submitted":
      return `واجب جديد بانتظار التصحيح 📝\nالطالب: ${e.studentName}\nالواجب: «${e.hwTitle}»`;
    case "homework_graded": {
      const pct = e.total > 0 ? Math.round((e.score / e.total) * 100) : 0;
      return `تصحيح واجب 📝\n${e.studentName} حصل على ${e.score}/${e.total} (${pct}%) في «${e.hwTitle}»`;
    }
    case "digest_weekly":
      // نص التقرير مُركّب مسبقاً في lib/digest (wa_text) — يُرسل حرفياً بلا إعادة صياغة
      return e.text;
  }
}

function titlesFallback(kind: NotifyEvent["kind"]): string {
  return {
    attendance_absent: "تنبيه غياب 📋",
    exam_graded: "نتيجة امتحان 📝",
    payment_received: "تم استلام دفعة ✅",
    payment_reminder: "تذكير بالمصروفات 🔔",
    homework_submitted: "واجب جديد 📝",
    homework_graded: "تصحيح واجب 📝",
    digest_weekly: "التقرير الأسبوعي 📊",
  }[kind];
}

/** عداد واتساب الشهري للسنتر (للفوترة لاحقاً — 1000 مجاناً/شهر للمنصة) */
async function bumpWaUsage(admin: any, tenantId: string): Promise<void> {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const { data: cur } = await admin.from("wa_usage").select("count").eq("tenant_id", tenantId).eq("month", month).single();
    if ((cur as any)?.count != null) {
      await admin.from("wa_usage").update({ count: ((cur as any).count ?? 0) + 1 }).eq("tenant_id", tenantId).eq("month", month);
    } else {
      await admin.from("wa_usage").insert({ tenant_id: tenantId, month, count: 1 });
    }
  } catch {}
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
  const settings = (tenant?.settings as any) ?? {};
  const enabled = settings.notify_whatsapp !== false;
  // قاعدة الحدث المخصصة (الجولة 27): إيقاف الحدث = تخطٍّ صامت مسجل
  if (settings.notify_rules?.[event.kind] === false) {
    try {
      await admin.from("notification_log").insert({
        tenant_id: tenantId, user_id: studentId, event: event.kind, channel: "whatsapp",
        payload: { reason: "disabled_by_rule" }, status: "skipped",
        dedupe_key: dedupeKey, sent_at: null,
      });
    } catch {}
    return { sent: false, reason: "disabled_by_rule" };
  }
  // كتم مؤقت: لا إرسال حتى انتهاء المدة (يعود تلقائياً)
  const snoozedUntil = (settings.notify_snooze as any)?.[event.kind] as string | undefined;
  if (snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()) {
    try {
      await admin.from("notification_log").insert({
        tenant_id: tenantId, user_id: studentId, event: event.kind, channel: "whatsapp",
        payload: { reason: "snoozed_until", until: snoozedUntil }, status: "skipped",
        dedupe_key: dedupeKey, sent_at: null,
      });
    } catch {}
    return { sent: false, reason: "snoozed" };
  }

  // تجاوز قالب السنتر المخصص (قوالب الجولة 21) — {placeholders}
  const TPL_KEY: Record<NotifyEvent["kind"], string> = {
    attendance_absent: "absence_alert", exam_graded: "exam_grade",
    payment_received: "payment_receipt", payment_reminder: "installment_reminder",
    homework_submitted: "session_reminder", homework_graded: "exam_grade",
    digest_weekly: "digest_weekly",
  };
  let body: string | null = null;
  try {
    const { data: tpl } = await admin.from("message_templates").select("body")
      .eq("tenant_id", tenantId).eq("key", TPL_KEY[event.kind]).eq("is_active", true).limit(1).single();
    const tb = (tpl as any)?.body as string | undefined;
    if (tb) {
      const ev = event as any;
      body = tb.replace("{student}", ev.studentName || student?.full_name || "الطالب")
        .replace("{amount}", String(ev.amount ?? "")).replace("{receipt}", ev.receiptNo != null ? `#${ev.receiptNo}` : "")
        .replace("{center}", ev.centerName || "").replace("{exam}", ev.examTitle || ev.hwTitle || "")
        .replace("{score}", String(ev.score ?? "")).replace("{total}", String(ev.total ?? ""))
        .replace("{date}", new Date().toLocaleDateString("ar-EG")).replace("{periods}", ev.periods || "");
    }
  } catch {}
  if (!body) body = renderBody({
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
      await bumpWaUsage(admin, tenantId);
    } else {
      status = "failed";
      reason = r.reason;
    }
  }

  const { data: wlog } = await admin.from("notification_log").insert({
    tenant_id: tenantId,
    user_id: studentId,
    event: event.kind,
    channel: "whatsapp",
    payload: { body, reason },
    status,
    dedupe_key: dedupeKey,
    sent_at: sentAt,
  }).select("id").single();

  // فشل واتساب → مهمة إعادة خلفية (backoff أسي) بدل الضياع
  if (!sent && status === "failed" && (wlog as any)?.id) {
    try {
      const { enqueueJob } = await import("./bg");
      await enqueueJob(admin, {
        tenantId, kind: "notify_retry",
        payload: { logId: (wlog as any).id },
        dedupeKey: `nretry:${(wlog as any).id}`,
      });
    } catch {} // eslint-disable-line no-empty
  }

  // Web Push لأجهزة الطالب/ولي الأمر (best-effort — يصل حتى والتطبيق مقفول)
  let pushSent = 0;
  try {
    const { sendPushToUser } = await import("./push");
    const titles: Record<NotifyEvent["kind"], string> = {
      attendance_absent: "تنبيه غياب 📋",
      exam_graded: "نتيجة امتحان 📝",
      payment_received: "تم استلام دفعة ✅",
      payment_reminder: "تذكير بالمصروفات 🔔",
      homework_submitted: "واجب جديد 📝",
      homework_graded: "تصحيح واجب 📝",
      digest_weekly: "التقرير الأسبوعي 📊",
    };
    const r = await sendPushToUser(admin, tenantId, studentId, {
      title: titles[event.kind],
      body: body.slice(0, 150),
      url: "/progress",
    });
    pushSent = r.sent;
    if (r.sent > 0 || r.cleaned > 0) {
      await admin.from("notification_log").insert({
        tenant_id: tenantId, user_id: studentId, event: event.kind, channel: "webpush",
        payload: { sent: r.sent, cleaned: r.cleaned }, status: r.sent > 0 ? "sent" : "queued",
        dedupe_key: dedupeKey + ":push", sent_at: r.sent > 0 ? new Date().toISOString() : null,
      });
    }
  } catch {} // eslint-disable-line no-empty

  // تليجرام المنصة (مجاني غير محدود): رابط chat_id المخزن لنفس الطالب
  let tgSent = false;
  try {
    const { sendTelegram, isTelegramLive } = await import("./telegram");
    if (isTelegramLive()) {
      const { data: link } = await admin.from("telegram_links").select("chat_id")
        .eq("tenant_id", tenantId).eq("user_id", studentId).limit(1).single();
      const chatId = (link as any)?.chat_id as number | undefined;
      if (chatId) {
        const tr = await sendTelegram(chatId, `${titlesFallback(event.kind)}\n${body.slice(0, 300)}`);
        tgSent = tr.ok;
        if (tr.ok === false && tr.reason === "blocked") {
          await admin.from("telegram_links").delete().eq("tenant_id", tenantId).eq("user_id", studentId);
        }
        await admin.from("notification_log").insert({
          tenant_id: tenantId, user_id: studentId, event: event.kind, channel: "telegram",
          payload: { ok: tr.ok, reason: tr.ok ? undefined : tr.reason }, status: tr.ok ? "sent" : "failed",
          dedupe_key: dedupeKey + ":tg", sent_at: tr.ok ? new Date().toISOString() : null,
        });
      }
    }
  } catch {} // eslint-disable-line no-empty

  // بريد المنصة (Resend — مجاني حتى 3000/شهر): يُحل بريد الطالب من auth عند الإمكان
  try {
    const { sendMail, isMailLive } = await import("./mail");
    if (isMailLive()) {
      const { data: urow2 } = await admin.from("users").select("auth_user_id").eq("id", studentId).limit(1).single();
      const auid = (urow2 as any)?.auth_user_id as string | undefined;
      if (auid) {
        const { data: au } = await admin.auth.admin.getUserById(auid);
        const email = au?.user?.email as string | undefined;
        if (email) {
          const mr = await sendMail(email, titlesFallback(event.kind), body.slice(0, 1000));
          if (mr.ok) {
            await admin.from("notification_log").insert({
              tenant_id: tenantId, user_id: studentId, event: event.kind, channel: "email",
              payload: {}, status: "sent", dedupe_key: dedupeKey + ":mail", sent_at: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {} // eslint-disable-line no-empty

  // SMS احتياطي: تنبيه حرج لم يصل push → طابور (يُعالج عبر /api/sms/process)
  const CRITICAL: NotifyEvent["kind"][] = ["attendance_absent", "exam_graded"];
  if (pushSent === 0 && CRITICAL.includes(event.kind) && target) {
    try {
      await admin.from("sms_queue").insert({
        tenant_id: tenantId, user_id: studentId, phone: target,
        body: body.slice(0, 300), event: event.kind,
      });
    } catch {}
  }

  return { sent, reason: sent ? undefined : reason };
}

/**
 * إشعار مالك السنتر (إيصال اشتراك منصة): واتساب مباشر إن كان حياً، وإلا طابور SMS.
 * idempotency عبر dedupe_key — إعادة تنفيذ الـcallback لا ترسل مرتين.
 */
export async function notifyOwner(
  admin: any,
  opts: { tenantId: string; body: string; event: string; dedupeKey: string }
): Promise<{ sent: boolean; channel?: string }> {
  const { tenantId, body, event, dedupeKey } = opts;
  try {
    const { data: dup } = await admin.from("notification_log")
      .select("id").eq("dedupe_key", dedupeKey).limit(1);
    if (dup?.length) return { sent: false };
    const { data: owner } = await admin.from("users").select("id")
      .eq("tenant_id", tenantId).eq("role", "teacher_admin").limit(1).single();
    const ownerId = (owner as any)?.id ?? null;
    const { data: t } = await admin.from("tenants").select("settings").eq("id", tenantId).single();
    const phone = String((t as any)?.settings?.owner_phone ?? "").trim();
    if (!phone) return { sent: false };
    const { isWhatsAppLive, sendWhatsAppText } = await import("./whatsapp");
    if (isWhatsAppLive()) {
      const r = await sendWhatsAppText(phone, body);
      if ((r as any)?.ok) {
        // سجل notification_log يشترط user_id — يُسجَّل فقط عند وجود صف المالك
        if (ownerId) {
          await admin.from("notification_log").insert({
            tenant_id: tenantId, user_id: ownerId, event,
            channel: "whatsapp", payload: {}, status: "sent",
            dedupe_key: dedupeKey, sent_at: new Date().toISOString(),
          }).then(() => {}, () => {});
        }
        return { sent: true, channel: "whatsapp" };
      }
    }
    await admin.from("sms_queue").insert({
      tenant_id: tenantId, user_id: ownerId, phone,
      body: body.slice(0, 300), event,
    });
    // توثيق الإرسال ليعمل dedupe اليومي حتى في مسار SMS (يتخطى فقط لو لا صف مالك)
    if (ownerId) {
      await admin.from("notification_log").insert({
        tenant_id: tenantId, user_id: ownerId, event,
        channel: "sms", payload: {}, status: "queued",
        dedupe_key: dedupeKey, sent_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
    return { sent: true, channel: "sms_queued" };
  } catch {
    return { sent: false };
  }
}
