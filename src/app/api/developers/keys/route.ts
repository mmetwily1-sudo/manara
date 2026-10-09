import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/developers/keys — مفاتيح السنتر (مالك، بدون القيم) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data, error } = await res.ctx.admin.from("api_keys")
    .select("id,name,key_prefix,revoked,last_used_at,created_at").eq("tenant_id", res.ctx.tenantId)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return dbFail("keys-list", error);
  return NextResponse.json({ ok: true, keys: data ?? [] });
}

/** POST /api/developers/keys {name} — إصدار مفتاح (يظهر مرة واحدة) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!String(b?.name ?? "").trim()) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const raw = `mk_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const { data, error } = await res.ctx.admin.from("api_keys").insert({
    tenant_id: res.ctx.tenantId, name: String(b.name).slice(0, 80),
    key_prefix: raw.slice(0, 10), key_hash: hash,
  }).select("id").single();
  if (error || !data) return dbFail("key-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id, key: raw, warning: "انسخه الآن — لن يظهر مجدداً." });
}

/** PATCH /api/developers/keys {id, revoked} — إلغاء/استعادة */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await res.ctx.admin.from("api_keys").update({ revoked: !!b.revoked })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("key-toggle", error);
  return NextResponse.json({ ok: true });
}
