import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner-guard";
import { enqueueJob } from "@/lib/bg";

/** POST /api/admin/notify/retry { log_id } — إعادة إرسال تنبيه فاشل عبر العامل (dedupe يمنع التكرار). */
export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("error" in gate) return gate.error;
  const b = await req.json().catch(() => ({} as any));
  const logId = String(b?.log_id ?? "");
  if (!logId) return NextResponse.json({ ok: false, error: "log_required" }, { status: 400 });
  const { data: log } = await gate.admin.from("notification_log").select("id,tenant_id,status").eq("id", logId).single();
  if (!log) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if ((log as any).status === "sent") return NextResponse.json({ ok: false, error: "already_sent" }, { status: 400 });
  await enqueueJob(gate.admin, {
    tenantId: (log as any).tenant_id, kind: "notify_retry",
    payload: { logId }, dedupeKey: `nretry:${logId}`,
  });
  return NextResponse.json({ ok: true });
}
