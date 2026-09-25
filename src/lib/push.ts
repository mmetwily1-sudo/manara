/**
 * Web Push للغياب والنتائج (يصل حتى والتطبيق مقفول — بشرط سماح المتصفح/النظام).
 * - VAPID_PRIVATE_KEY لا يغادر السيرفر أبداً (توصية اللجنة).
 * - 404/410 → حذف الاشتراك الميت فوراً (لا إعادة إرسال).
 * - الإرسال server-side فقط.
 */

type PushPayload = { title: string; body: string; url?: string };

function vapid() {
  const pub = process.env.VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  const subj = process.env.VAPID_SUBJECT ?? "mailto:support@manara.app";
  if (!pub || !priv) return null;
  return { pub, priv, subj };
}

/** إرسال لمشترك واحد — يرجع "sent" | "dead" | "retry" */
export async function sendOne(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<string> {
  const v = vapid();
  if (!v) return "retry";
  const mod: any = await import("web-push");
  const wp: any = mod.default ?? mod;
  wp.setVapidDetails(v.subj, v.pub, v.priv);
  try {
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/progress" })
    );
    return "sent";
  } catch (e: any) {
    const code = Number(e?.statusCode ?? 0);
    if (code === 404 || code === 410) return "dead";
    return "retry";
  }
}

/** إرسال لكل أجهزة مستخدم + تنظيف الميت — best-effort دائماً */
export async function sendPushToUser(
  admin: any, tenantId: string, userId: string, payload: PushPayload
): Promise<{ sent: number; cleaned: number }> {
  let sent = 0, cleaned = 0;
  try {
    const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth")
      .eq("tenant_id", tenantId).eq("user_id", userId).limit(10);
    for (const s of (subs ?? []) as any[]) {
      const r = await sendOne(s, payload);
      if (r === "sent") {
        sent++;
        admin.from("push_subscriptions").update({ last_seen_at: new Date().toISOString() }).eq("id", s.id).then(() => {});
      } else if (r === "dead") {
        cleaned++;
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  } catch {}
  return { sent, cleaned };
}
