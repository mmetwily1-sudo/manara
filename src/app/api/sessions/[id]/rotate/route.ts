import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { randomBytes } from "node:crypto";

/** POST /api/sessions/[id]/rotate — توليد سر QR جديد صالح 90 ثانية (طاقم التحضير) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const { data: s } = await res.ctx.admin.from("sessions").select("id,group_id")
    .eq("id", params.id).eq("tenant_id", res.ctx.tenantId).single();
  if (!s) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const secret = randomBytes(6).toString("hex");
  const expires = new Date(Date.now() + 90 * 1000).toISOString();
  await res.ctx.admin.from("sessions").update({ qr_secret: secret, qr_expires_at: expires }).eq("id", params.id);
  return NextResponse.json({ ok: true, secret, expires_at: expires });
}
