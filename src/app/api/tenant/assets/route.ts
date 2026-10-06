import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";
import { randomBytes } from "node:crypto";

const ALLOW = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const MAX = 2 * 1024 * 1024;

/**
 * POST /api/tenant/assets (multipart file=) — رفع صور موقع السنتر (2MB، صور فقط).
 * يرجع رابطاً عاماً يُستخدم في المعرض/الشعار/الخلفيات.
 */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_upload" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  const ext = ALLOW.get(file.type);
  if (!ext || file.size <= 0 || file.size > MAX) {
    return NextResponse.json({ ok: false, error: "bad_file", message: "صور فقط (jpg/png/webp/gif) حتى 2MB" }, { status: 400 });
  }
  const admin = adminClient();
  const path = `${res.ctx.tenantId}/${randomBytes(12).toString("hex")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from("site-assets").upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  const { data } = admin.storage.from("site-assets").getPublicUrl(path);
  try {
    await admin.from("audit_log").insert({
      tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id, action: "site:upload", entity_type: "asset", entity_id: path, details: { size: file.size },
    });
  } catch {}
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
