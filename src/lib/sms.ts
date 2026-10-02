/**
 * SMS الاحتياطي (Outbox pattern — توصية اللجنة):
 * - عند فشل Push في تنبيه حرج (غياب/نتيجة) يُحفظ SMS في الطابور بدل الضياع الصامت.
 * - المعالجة: POST /api/sms/process (cron) — المزود `log` (يسجل فقط) أو `twilio`
 *   (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM + SMS_DRIVER=twilio).
 * - لتفعيل الإرسال الحقيقي: أضف Twilio (TWILIO_*) وبدّل DRIVER.
 */

export type SmsJob = { id: string; phone: string; body: string };

async function sendViaDriver(job: SmsJob): Promise<{ ok: boolean; reason?: string }> {
  const driver = process.env.SMS_DRIVER ?? "log";
  if (driver === "log") {
    console.log(`[sms-outbox] to=${job.phone} body=${job.body.slice(0, 80)}`);
    return { ok: true };
  }
  if (driver === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
    const token = process.env.TWILIO_AUTH_TOKEN ?? "";
    const from = process.env.TWILIO_FROM ?? "";
    if (!sid || !token || !from) return { ok: false, reason: "twilio_not_configured" };
    try {
      const to = job.phone.startsWith("+") ? job.phone : `+${job.phone}`;
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: job.body.slice(0, 1600) }).toString(),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !(j as any)?.sid) {
        console.error("[sms-twilio] failed:", JSON.stringify(j)?.slice(0, 200));
        return { ok: false, reason: "twilio_" + r.status };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: "network" };
    }
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
