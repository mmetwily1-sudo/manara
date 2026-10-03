/**
 * منفذ المهام الخلفية — يُستدعى من /api/worker/run (UptimeRobot كل 5 دقائق + كورون يومي).
 * - الاستيلاء ذري (compare-and-set على status) لمنع التنفيذ المزدوج.
 * - backoff أسي: 2^attempts دقيقة (بحد 6 ساعات) ثم dead بعد max_attempts.
 * - الميزانية: 10 مهام/دورة كحد أقصى (مهلة Hobby).
 */

import { randomBytes } from "node:crypto";

const BATCH = 10;

function backoffMin(attempts: number): number {
  return Math.min(360, Math.pow(2, attempts));
}

export async function runDueJobs(admin: any): Promise<{ ran: number; done: number; failed: number; rescued: number }> {
  let ran = 0, done = 0, failed = 0;
  // إنقاذ اليتامى: running معلقة >10 دقائق (مات العامل قبل إنهائها) → تعود queued
  let rescued = 0;
  try {
    const cutoff = new Date(Date.now() - 10 * 60000).toISOString();
    const { data: orphans } = await admin.from("bg_jobs").select("id")
      .eq("status", "running").lt("leased_at", cutoff).limit(BATCH);
    for (const o of ((orphans ?? []) as any[])) {
      const { data: ok } = await admin.from("bg_jobs").update({
        status: "queued", leased_at: null, lease_token: null,
        last_error: "orphan_rescue",
      }).eq("id", o.id).eq("status", "running").select("id").single();
      if (ok) rescued++;
    }
  } catch {} // eslint-disable-line no-empty
  const { data: due } = await admin.from("bg_jobs").select("id,tenant_id,kind,payload,attempts,max_attempts")
    .eq("status", "queued").lte("run_at", new Date().toISOString())
    .order("run_at").limit(BATCH);
  for (const j of ((due ?? []) as any[])) {
    if (ran >= BATCH) break;
    const lease = randomBytes(8).toString("hex");
    // استيلاء ذري: فقط لو ما زالت queued
    const { data: got } = await admin.from("bg_jobs").update({
      status: "running", leased_at: new Date().toISOString(), lease_token: lease,
    }).eq("id", j.id).eq("status", "queued").select("id").single();
    if (!got) continue; // عامل آخر سبقنا
    ran++;
    try {
      const ok = await execJob(admin, j.kind, (j.payload ?? {}) as any);
      if (ok) {
        await admin.from("bg_jobs").update({ status: "done" }).eq("id", j.id).eq("lease_token", lease);
        done++;
      } else {
        throw new Error("handler_false");
      }
    } catch (e: any) {
      failed++;
      const attempts = (j.attempts ?? 0) + 1;
      if (attempts >= (j.max_attempts ?? 5)) {
        await admin.from("bg_jobs").update({
          status: "dead", attempts, last_error: String(e?.message ?? e).slice(0, 300),
        }).eq("id", j.id).eq("lease_token", lease);
      } else {
        const next = new Date(Date.now() + backoffMin(attempts) * 60000).toISOString();
        await admin.from("bg_jobs").update({
          status: "queued", attempts, run_at: next,
          leased_at: null, lease_token: null, last_error: String(e?.message ?? e).slice(0, 300),
        }).eq("id", j.id).eq("lease_token", lease);
      }
    }
  }
  return { ran, done, failed, rescued };
}

async function execJob(admin: any, kind: string, payload: any): Promise<boolean> {
  if (kind === "notify_retry") return retryNotify(admin, payload);
  if (kind === "sms_flush") {
    const { processSmsBatch } = await import("./sms");
    const out = await processSmsBatch(admin, 50);
    return (out.failed ?? 0) === 0 || (out.sent ?? 0) > 0;
  }
  return false;
}

/** إعادة إرسال واتساب فاشل: يعيد حل الرقم والإعدادات لحظياً (قد يكون المالك فعّل القناة بعدها) */
async function retryNotify(admin: any, payload: any): Promise<boolean> {
  const logId = String(payload?.logId ?? "");
  if (!logId) return true; // مهمة فاسدة — اعتبرها منجزة
  const { data: log } = await admin.from("notification_log").select("*").eq("id", logId).single();
  if (!log || (log as any).status === "sent") return true;
  const tenantId = (log as any).tenant_id as string;
  const userId = (log as any).user_id as string;
  const body = String(((log as any).payload as any)?.body ?? "");
  if (!body) return true;
  const [{ data: student }, { data: tenant }] = await Promise.all([
    admin.from("users").select("phone").eq("id", userId).single(),
    admin.from("tenants").select("settings").eq("id", tenantId).single(),
  ]);
  if (((tenant as any)?.settings as any)?.notify_whatsapp === false) return true;
  const { normalizePhone, sendWhatsAppText, isWhatsAppLive } = await import("./whatsapp");
  const target = normalizePhone(String((student as any)?.phone ?? ""));
  if (!target || !isWhatsAppLive()) return false; // أعد لاحقاً
  const r = await sendWhatsAppText(target, body);
  if (!r.ok) return false;
  await admin.from("notification_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", logId);
  return true;
}
