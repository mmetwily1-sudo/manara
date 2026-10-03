/** طابور المهام الخلفية — إيداع فقط (التنفيذ في /api/worker/run). */

export type BgKind = "notify_retry" | "sms_flush" | "digest_weekly";

/** إيداع مهمة idempotent عبر dedupe_key — التكرار يُتجاهل بصمت */
export async function enqueueJob(
  admin: any,
  job: { tenantId?: string | null; kind: BgKind; payload: Record<string, unknown>; dedupeKey: string; runAt?: string; maxAttempts?: number }
): Promise<boolean> {
  try {
    const { error } = await admin.from("bg_jobs").insert({
      tenant_id: job.tenantId ?? null,
      kind: job.kind,
      payload: job.payload,
      dedupe_key: job.dedupeKey,
      run_at: job.runAt ?? new Date().toISOString(),
      max_attempts: job.maxAttempts ?? 5,
    });
    if (error && !String(error.message ?? "").toLowerCase().includes("duplicate")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
