import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/auth/devices — سجل الأجهزة (مالك: الكل؛ طاقم: أجهزته) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin", "supervisor", "assistant", "accountant"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const isOwner = res.ctx.userRow.role === "teacher_admin";
  let q = admin.from("login_devices").select("id,user_id,device_label,first_seen,last_seen,trusted,revoked,users(full_name)")
    .eq("tenant_id", res.ctx.tenantId).order("last_seen", { ascending: false }).limit(100);
  if (!isOwner) q = q.eq("user_id", res.ctx.userRow.id);
  const { data } = await q;
  return NextResponse.json({ ok: true, isOwner, devices: data ?? [] });
}

/** POST /api/auth/devices {id, action:"trust"|"revoke"} — توثيق أو إنهاء جهاز (مالك) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const b = await req.json().catch(() => ({} as any));
  if (!["trust", "revoke"].includes(b?.action)) {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  }
  const { data: dev } = await admin.from("login_devices").select("id,user_id,users(auth_user_id)")
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId).single();
  if (!dev) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (b.action === "trust") {
    await admin.from("login_devices").update({ trusted: true }).eq("id", b.id);
  } else {
    await admin.from("login_devices").update({ revoked: true }).eq("id", b.id);
    // إنهاء كل جلسات المستخدم فوراً من جهة السيرفر
    try {
      const auid = (dev as any)?.users?.auth_user_id as string | undefined;
      if (auid) await admin.auth.admin.signOut(auid);
    } catch {}
    try {
      await admin.from("audit_log").insert({
        tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
        action: "auth:revoke_device", entity_type: "login_device", entity_id: b.id,
        details: { user: (dev as any).user_id },
      });
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
