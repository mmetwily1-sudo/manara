import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/tenant/branding — الهوية الحالية (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data, error } = await adminClient().from("tenants")
    .select("name,logo_url,primary_color").eq("id", res.ctx.tenantId).single();
  if (error) return dbFail("branding-get", error);
  return NextResponse.json({ ok: true, branding: data ?? {} });
}

/** PUT /api/tenant/branding {logo_url?, primary_color?} — تحديث الهوية (مالك) */
export async function PUT(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const patch: Record<string, unknown> = {};
  if (b?.logo_url !== undefined) {
    const u = String(b.logo_url ?? "").trim().slice(0, 500);
    if (u && !/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(u)) {
      return NextResponse.json({ ok: false, error: "bad_logo" }, { status: 400 });
    }
    patch.logo_url = u || null;
  }
  if (b?.primary_color !== undefined) {
    const c = String(b.primary_color ?? "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) {
      return NextResponse.json({ ok: false, error: "bad_color" }, { status: 400 });
    }
    patch.primary_color = c;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  const { error } = await adminClient().from("tenants").update(patch).eq("id", res.ctx.tenantId);
  if (error) return dbFail("branding-update", error);
  return NextResponse.json({ ok: true });
}
