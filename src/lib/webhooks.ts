import { createHash } from "node:crypto";

/** إرسال حدث لويبهوكات السنتر (best-effort + سجل تسليم + توقيع HMAC) */
export async function fireWebhooks(admin: any, tenantId: string, event: string, payload: Record<string, unknown>) {
  try {
    const { data: hooks } = await admin.from("outgoing_webhooks").select("id,url,secret")
      .eq("tenant_id", tenantId).eq("is_active", true).contains("events", [event]).limit(10);
    for (const h of (hooks ?? []) as any[]) {
      const body = JSON.stringify({ event, tenant_id: tenantId, at: new Date().toISOString(), data: payload });
      let code: number | null = null;
      let ok = false;
      try {
        const sig = (h as any).secret
          ? createHash("sha256").update(`${(h as any).secret}.${body}`).digest("hex")
          : "";
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch((h as any).url, {
          method: "POST", headers: { "Content-Type": "application/json", ...(sig ? { "X-Manara-Signature": sig } : {}) },
          body, signal: ctl.signal,
        });
        clearTimeout(to);
        code = r.status;
        ok = r.ok;
      } catch { ok = false; }
      try {
        await admin.from("webhook_deliveries").insert({
          tenant_id: tenantId, webhook_id: (h as any).id, event, status_code: code, ok,
        });
      } catch {}
    }
  } catch {}
}
