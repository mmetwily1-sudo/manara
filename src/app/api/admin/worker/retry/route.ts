import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner-guard";

/** POST /api/admin/worker/retry { job_id } — إحياء مهمة ميتة (تعاود من المحاولة 0). */
export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("error" in gate) return gate.error;
  const b = await req.json().catch(() => ({} as any));
  const jobId = String(b?.job_id ?? "");
  if (!jobId) return NextResponse.json({ ok: false, error: "job_required" }, { status: 400 });
  const { error } = await gate.admin.from("bg_jobs").update({
    status: "queued", attempts: 0, run_at: new Date().toISOString(),
    leased_at: null, lease_token: null, last_error: `revived by ${gate.email}`,
  }).eq("id", jobId).eq("status", "dead");
  if (error) return NextResponse.json({ ok: false, error: "retry_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
