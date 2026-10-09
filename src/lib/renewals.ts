/**
 * التجديد التلقائي — Phase 1: تذكير + رابط دفع + إنفاذ، بلا شحن صامت.
 * - تُدار فقط السناتر المدفوعة سابقاً (لها plan_paid_until) — التجارب تُتجاهل بصمت.
 * - التذكير عند الانتقال فقط (due_soon/grace/suspended) + حارس يومي ضد التكرار.
 * - القناة: واتساب مباشر إن كان حياً، وإلا طابور SMS (user_id فارغ = للمالك).
 * - idempotent: إعادة التشغيل نفس اليوم لا تكرر انتقالاً ولا تذكيراً.
 */

export type RenewalState = "active" | "due_soon" | "grace" | "suspended" | "cancelled";

const DUE_SOON_DAYS = 3;
const GRACE_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

export async function logRenewalEvent(admin: any, tenantId: string, from: string, to: string, trigger: string) {
  try {
    await admin.from("tenant_renewal_events").insert({
      tenant_id: tenantId, from_state: from, to_state: to, trigger,
    });
  } catch {}
}

async function sendOwnerReminder(admin: any, tenantId: string, centerName: string, kind: "due_soon" | "grace" | "suspended") {
  try {
    const { data: t } = await admin.from("tenants").select("settings").eq("id", tenantId).single();
    const phone = String((t as any)?.settings?.owner_phone ?? "").trim();
    if (!phone) return "no_phone";
    const bodies: Record<string, string> = {
      due_soon: `تذكير منارة: اشتراك سنتر ${centerName} ينتهي قريباً — جدّد من صفحة الفوترة في لوحتك لاستمرار الخدمة بلا انقطاع.`,
      grace: `عاجل منارة: انتهى اشتراك سنتر ${centerName} ودخل فترة السماح — جدّد الآن من صفحة الفوترة قبل الإيقاف.`,
      suspended: `منارة: تم إيقاف سنتر ${centerName} مؤقتاً لانتهاء الاشتراك — جدّد من صفحة الفوترة لإعادة التفعيل فوراً.`,
    };
    const body = bodies[kind];
    const { isWhatsAppLive, sendWhatsAppText } = await import("./whatsapp");
    if (isWhatsAppLive()) {
      const r = await sendWhatsAppText(phone, body);
      return (r as any)?.ok ? "whatsapp" : "wa_failed";
    }
    await admin.from("sms_queue").insert({
      tenant_id: tenantId, user_id: null, phone, body: body.slice(0, 300), event: "renewal_reminder",
    });
    return "sms_queued";
  } catch {
    return "failed";
  }
}

async function transition(admin: any, tenantId: string, centerName: string, from: RenewalState, to: RenewalState, extra: Record<string, any> = {}) {
  const today = new Date().toISOString().slice(0, 10);
  let channel = "none";
  let reminderStamp: string | null = null;
  if (to === "due_soon" || to === "grace" || to === "suspended") {
    // حارس يومي: يُقرأ قبل الإرسال (الكتابة نفسها ذرية أدناه، فأسوأ الحالات تكرار تذكير لا فقدان بيانات)
    const { data: cur } = await admin.from("tenants").select("settings").eq("id", tenantId).single();
    if (((cur as any)?.settings ?? {}).renewal_reminder_sent_at !== today) {
      channel = await sendOwnerReminder(admin, tenantId, centerName, to);
      reminderStamp = today;
    }
  }
  // كتابة ذرية: تلمس مفاتيح التجديد فقط — لا تقرأ settings كاملاً فلا تمسح مفاتيح كاتب آخر
  // (مثل plan_paid_until من callback الدفع). تُنفذ كعملية SQL واحدة عبر 088.
  await admin.rpc("tenant_patch_settings", {
    p_tenant_id: tenantId,
    p_patch: { renewal_state: to, ...extra, ...(reminderStamp ? { renewal_reminder_sent_at: reminderStamp } : {}) },
  });
  await logRenewalEvent(admin, tenantId, from, to, "cron");
  return { to, channel };
}

export async function runRenewals(admin: any) {
  const { data: tenants } = await admin.from("tenants")
    .select("id,name,slug,status,settings").eq("status", "active").limit(500);
  const now = Date.now();
  let scanned = 0, checked = 0, transitioned = 0, reminded = 0;
  for (const t of (tenants ?? []) as any[]) {
    try {
      scanned++;
      const s = (t.settings ?? {}) as any;
      if (s.auto_renew_opt_out === true) continue; // المالك أوقف التذكيرات — تُحترم دائماً
      const paidUntil = s.plan_paid_until ? Date.parse(String(s.plan_paid_until)) : NaN;
      if (!Number.isFinite(paidUntil)) continue; // تجربة/لم يدفع أبداً — خارج النطاق
      const state = (s.renewal_state ?? "active") as RenewalState;
      if (state === "cancelled" || state === "suspended") { checked++; continue; }
      const remaining = paidUntil - now;
      checked++;
      if (remaining > DUE_SOON_DAYS * DAY) {
        if (state !== "active") {
          await transition(admin, t.id, t.name, state, "active");
          transitioned++;
        }
        continue;
      }
      if (remaining > 0) {
        if (state === "active") {
          const r = await transition(admin, t.id, t.name, state, "due_soon");
          transitioned++;
          if (r.channel !== "none" && r.channel !== "no_phone") reminded++;
        }
        continue;
      }
      // منتهٍ فعلاً
      if (state === "active" || state === "due_soon") {
        const r = await transition(admin, t.id, t.name, state, "grace",
          { grace_until: new Date(now + GRACE_DAYS * DAY).toISOString() });
        transitioned++;
        if (r.channel !== "none" && r.channel !== "no_phone") reminded++;
        continue;
      }
      if (state === "grace") {
        const graceUntil = s.grace_until ? Date.parse(String(s.grace_until)) : NaN;
        if (Number.isFinite(graceUntil) && now > graceUntil) {
          const r = await transition(admin, t.id, t.name, state, "suspended");
          transitioned++;
          if (r.channel !== "none" && r.channel !== "no_phone") reminded++;
        }
        continue;
      }
    } catch {}
  }
  return { scanned, checked, transitioned, reminded };
}
