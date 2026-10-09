import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { randomBytes } from "node:crypto";

/** GET /api/sessions/[id]/rotate — السر الحالي إن كان صالحاً (للمسح من لوحة المعلم) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const { data: s } = await res.ctx.admin.from("sessions").select("id,qr_secret,qr_expires_at")
    .eq("id", params.id).eq("tenant_id", res.ctx.tenantId).single();
  if (!s || !(s as any).qr_secret) return NextResponse.json({ ok: false, error: "no_code" }, { status: 404 });
  if ((s as any).qr_expires_at && new Date((s as any).qr_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 410 });
  }
  return NextResponse.json({ ok: true, secret: (s as any).qr_secret, expires_at: (s as any).qr_expires_at });
}

/** POST /api/sessions/[id]/rotate — توليد سر QR جديد صالح 90 ثانية (طاقم التحضير) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance, { req: _req });
  if ("error" in res) return res.error;
  const { data: s } = await res.ctx.admin.from("sessions").select("id,group_id")
    .eq("id", params.id).eq("tenant_id", res.ctx.tenantId).single();
  if (!s) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const secret = randomBytes(6).toString("hex");
  const expires = new Date(Date.now() + 90 * 1000).toISOString();
  await res.ctx.admin.from("sessions").update({ qr_secret: secret, qr_expires_at: expires }).eq("id", params.id);
  return NextResponse.json({ ok: true, secret, expires_at: expires });
}
