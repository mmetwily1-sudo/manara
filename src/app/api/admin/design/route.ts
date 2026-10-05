import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner-guard";

/** GET — تصميم المنصة الحالي */
export async function GET() {
  const gate = await requireOwner();
  if ("error" in gate) return gate.error;
  const { data } = await gate.admin.from("platform_settings").select("value").eq("key", "design").single();
  return NextResponse.json({ ok: true, design: (data as any)?.value ?? {} });
}

/** POST { admin_accent?, lock_tenant_design? } — حفظ بتحقق صارم */
export async function POST(req: Request) {
  const gate = await requireOwner();
  if ("error" in gate) return gate.error;
  const b = await req.json().catch(() => ({} as any));
  const patch: Record<string, unknown> = {};
  if (typeof b.admin_accent !== "undefined") {
    const c = String(b.admin_accent ?? "").trim();
    if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) {
      return NextResponse.json({ ok: false, error: "bad_color" }, { status: 400 });
    }
    patch.admin_accent = c || null;
  }
  if (typeof b.lock_tenant_design !== "undefined") {
    patch.lock_tenant_design = !!b.lock_tenant_design;
  }
  const { data: cur } = await gate.admin.from("platform_settings").select("value").eq("key", "design").single();
  const next = { ...((cur as any)?.value ?? {}), ...patch };
  await gate.admin.from("platform_settings").upsert({ key: "design", value: next, updated_at: new Date().toISOString() });
  try {
    await gate.admin.from("audit_log").insert({
      tenant_id: null, actor_id: null, action: "owner:design", entity_type: "platform", entity_id: "design",
      details: { by: gate.email, patch },
    });
  } catch {}
  return NextResponse.json({ ok: true, design: next });
}
