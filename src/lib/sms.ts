/**
 * SMS الاحتياطي (Outbox pattern — توصية اللجنة):
 * - عند فشل Push في تنبيه حرج (غياب/نتيجة) يُحفظ SMS في الطابور بدل الضياع الصامت.
 * - المعالجة: POST /api/sms/process (cron) — المزود الحالي `log` (يسجل فقط).
 * - لتفعيل الإرسال الحقيقي: أضف Twilio (TWILIO_*) وبدّل DRIVER.
 */

export type SmsJob = { id: string; phone: string; body: string };

async function sendViaDriver(job: SmsJob): Promise<{ ok: boolean; reason?: string }> {
  const driver = process.env.SMS_DRIVER ?? "log";
  if (driver === "log") {
    console.log(`[sms-outbox] to=${job.phone} body=${job.body.slice(0, 80)}`);
    return { ok: true };
  }
  return { ok: false, reason: "unknown_driver:" + driver };
}

/** معالجة دفعة (حتى 50) — idempotent: يُرسل queued فقط ويُعلَّم sent/failed */
export async function processSmsBatch(admin: any, limit = 50) {
  const { data: jobs } = await admin.from("sms_queue").select("id,phone,body,attempts")
    .eq("status", "queued").order("created_at", { ascending: true }).limit(limit);
  let sent = 0, failed = 0;
  for (const j of (jobs ?? []) as any[]) {
    try {
      const r = await sendViaDriver({ id: j.id, phone: j.phone, body: j.body });
      if (r.ok) {
        sent++;
        await admin.from("sms_queue").update({ status: "sent", sent_at: new Date().toISOString(), attempts: (j.attempts ?? 0) + 1 }).eq("id", j.id);
      } else {
        failed++;
        await admin.from("sms_queue").update({ status: (j.attempts ?? 0) >= 4 ? "failed" : "queued", attempts: (j.attempts ?? 0) + 1 }).eq("id", j.id);
      }
    } catch {
      failed++;
      await admin.from("sms_queue").update({ attempts: (j.attempts ?? 0) + 1 }).eq("id", j.id);
    }
  }
  return { sent, failed, total: (jobs ?? []).length };
}
