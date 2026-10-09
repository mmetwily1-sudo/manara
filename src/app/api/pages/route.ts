import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** GET /api/pages — صفحات السنتر (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data, error } = await res.ctx.admin.from("tenant_pages")
    .select("id,slug,title,body,published,created_at").eq("tenant_id", res.ctx.tenantId)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return dbFail("pages-list", error);
  const { data: t } = await res.ctx.admin.from("tenants").select("slug").eq("id", res.ctx.tenantId).single();
  return NextResponse.json({ ok: true, tenant_slug: (t as any)?.slug ?? "", pages: data ?? [] });
}

/** POST /api/pages {slug, title, body} — صفحة جديدة (مالك) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const slug = String(b?.slug ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug) || !String(b?.title ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("tenant_pages").insert({
    tenant_id: res.ctx.tenantId, slug, title: String(b.title).slice(0, 150),
    body: String(b?.body ?? "").slice(0, 20000),
  });
  if (error) return dbFail("page-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/pages {id, title?, body?, published?} — تعديل/نشر (مالك) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const patch: any = {};
  if (b?.title !== undefined) patch.title = String(b.title).slice(0, 150);
  if (b?.body !== undefined) patch.body = String(b.body).slice(0, 20000);
  if (b?.published !== undefined) patch.published = !!b.published;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  const { error } = await res.ctx.admin.from("tenant_pages").update(patch)
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("page-update", error);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/pages?id= — حذف (مالك) */
export async function DELETE(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await res.ctx.admin.from("tenant_pages").delete()
    .eq("id", id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("page-delete", error);
  return NextResponse.json({ ok: true });
}
