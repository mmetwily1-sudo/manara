import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner-guard";

/**
 * POST /api/admin/tenants/action { tenant_id, action, value? }
 * suspend | activate | plan | extend30 — بتأكيد العميل + تدقيق.
 */
const PLANS = ["trial", "basic", "pro", "enterprise"];

export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("error" in gate) return gate.error;
  const { admin, email } = gate;
  const b = await req.json().catch(() => ({} as any));
  const tenantId = String(b?.tenant_id ?? "");
  const action = String(b?.action ?? "");
  const reason = String(b?.reason ?? "").trim().slice(0, 200);
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_required" }, { status: 400 });
  if (!reason) return NextResponse.json({ ok: false, error: "reason_required", message: "السبب إلزامي" }, { status: 400 });

  const { data: t } = await admin.from("tenants").select("id,name,status,plan,trial_ends_at").eq("id", tenantId).single();
  if (!t) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const before = { status: (t as any).status, plan: (t as any).plan, trial_ends_at: (t as any).trial_ends_at };

  let patch: Record<string, unknown> = {};
  if (action === "suspend") patch = { status: "suspended" };
  else if (action === "activate") patch = { status: "active" };
  else if (action === "plan") {
    const plan = String(b?.value ?? "");
    if (!PLANS.includes(plan)) return NextResponse.json({ ok: false, error: "bad_plan" }, { status: 400 });
    patch = { plan };
  } else if (action === "extend30") {
    const { data: cur } = await admin.from("tenants").select("trial_ends_at").eq("id", tenantId).single();
    const base = Math.max(Date.now(), new Date((cur as any)?.trial_ends_at ?? 0).getTime() || 0);
    patch = { trial_ends_at: new Date(base + 30 * 864e5).toISOString(), status: "active" };
  } else {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  }

  const { error } = await admin.from("tenants").update(patch).eq("id", tenantId);
  if (error) return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  try {
    await admin.from("audit_log").insert({
      tenant_id: tenantId, actor_id: null, action: `owner:${action}`, entity_type: "tenant", entity_id: tenantId,
      details: { by: email, value: (b as any)?.value ?? null, reason, before, after: patch },
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
