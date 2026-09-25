import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { remindTenant } from "@/lib/remind";

/** POST /api/invoices/remind — تذكير كل المتأخرين المستحقين الآن (مالك + محاسب) */
export async function POST() {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  try {
    const out = await remindTenant(res.ctx.admin, res.ctx.tenantId);
    try {
      await res.ctx.admin.from("audit_log").insert({
        tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
        action: "invoices:remind", entity_type: "invoice", entity_id: "bulk", details: out,
      });
    } catch {}
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return dbFail("remind", e);
  }
}
