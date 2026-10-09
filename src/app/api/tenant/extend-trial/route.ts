import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** POST /api/tenant/extend-trial — تمديد تجربة ذاتي +3 أيام، مرة واحدة فقط (مالك) */
export async function POST(req: Request) {
const res = await requireTeacher(["teacher_admin"], { req });
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const { data: t } = await admin.from("tenants").select("plan,trial_ends_at,settings").eq("id", tid).single();
  if ((t as any)?.plan !== "trial") return NextResponse.json({ ok: false, error: "not_on_trial" }, { status: 400 });
  if ((t as any)?.settings?.trial_extended) return NextResponse.json({ ok: false, error: "already_extended" }, { status: 400 });
  const base = Math.max(Date.now(), new Date((t as any)?.trial_ends_at ?? Date.now()).getTime());
  const next = new Date(base + 3 * 864e5).toISOString();
  const settings = { ...((t as any)?.settings ?? {}), trial_extended: true };
  const { error } = await admin.from("tenants").update({ trial_ends_at: next, settings }).eq("id", tid);
  if (error) return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "trial:extend", entity_type: "tenant", entity_id: tid, details: { days: 3, next },
    });
  } catch {}
  return NextResponse.json({ ok: true, trial_ends_at: next, days: 3 });
}
