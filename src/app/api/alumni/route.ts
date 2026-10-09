import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/alumni?public=1 — المميزون للجدار العام (بدون auth) | بدونها: الكل (معلم) */
export async function GET(req: Request) {
  const isPublic = new URL(req.url).searchParams.get("public") === "1";
  const tenantId = new URL(req.url).searchParams.get("tenant");
  if (isPublic) {
    if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_required" }, { status: 400 });
    const { adminClient } = await import("@/lib/server-auth");
    const admin = adminClient();
    const { data, error } = await admin.from("alumni").select("name,grad_year,achievement")
      .eq("tenant_id", tenantId).eq("featured", true).order("grad_year", { ascending: false }).limit(50);
    if (error) return dbFail("alumni-public", error);
    return NextResponse.json({ ok: true, rows: data ?? [] });
  }
  const res = await requireTeacher();
  if ("error" in res) return res.error;
  const { data, error } = await res.ctx.admin.from("alumni")
    .select("id,name,phone,grad_year,achievement,featured").eq("tenant_id", res.ctx.tenantId)
    .order("grad_year", { ascending: false }).limit(500);
  if (error) return dbFail("alumni-list", error);
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

/** POST /api/alumni {name, grad_year, achievement?, phone?} — تسجيل خريج (معلم) */
export async function POST(req: Request) {
  const res = await requireTeacher(undefined, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const year = Number(b?.grad_year ?? NaN);
  if (!String(b?.name ?? "").trim() || !(year >= 2000 && year <= 2100)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("alumni").insert({
    tenant_id: res.ctx.tenantId, name: String(b.name).slice(0, 80),
    phone: String(b?.phone ?? "").replace(/[^\d+]/g, "").slice(0, 20),
    grad_year: year, achievement: String(b?.achievement ?? "").slice(0, 500),
  });
  if (error) return dbFail("alumni-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/alumni {id, featured} — تمييز للجدار العام (معلم) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(undefined, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await res.ctx.admin.from("alumni").update({ featured: !!b.featured })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("alumni-feature", error);
  return NextResponse.json({ ok: true });
}
