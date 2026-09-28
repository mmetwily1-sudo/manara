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

/** POST /api/auth/devices {id?, action:"trust"|"revoke"|"revoke_others", user_id?} */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin", "supervisor", "assistant", "accountant"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const b = await req.json().catch(() => ({} as any));
  if (!["trust", "revoke", "revoke_others"].includes(b?.action)) {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  }
  const isOwner = res.ctx.userRow.role === "teacher_admin";
  if (b.action === "revoke_others") {
    // إنهاء كل أجهزتي (أو أجهزة موظف يحدده المالك) عدا جهاز واحد
    let targetUser = res.ctx.userRow.id;
    if (b?.user_id && b.user_id !== targetUser) {
      if (!isOwner) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      targetUser = b.user_id;
    }
    const { data: others } = await admin.from("login_devices").select("id")
      .eq("tenant_id", res.ctx.tenantId).eq("user_id", targetUser).neq("id", b?.except_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("revoked", false).limit(100);
    const ids = ((others ?? []) as any[]).map((d) => d.id);
    if (ids.length) await admin.from("login_devices").update({ revoked: true }).in("id", ids);
    try {
      const { data: tu } = await admin.from("users").select("auth_user_id").eq("id", targetUser).single();
      const auid = (tu as any)?.auth_user_id as string | undefined;
      if (auid) await admin.auth.admin.signOut(auid);
    } catch {}
    try {
      await admin.from("audit_log").insert({
        tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
        action: "auth:revoke_others", entity_type: "user", entity_id: targetUser, details: { count: ids.length },
      });
    } catch {}
    return NextResponse.json({ ok: true, revoked: ids.length });
  }
  const { data: dev } = await admin.from("login_devices").select("id,user_id,users(auth_user_id)")
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId).single();
  if (!dev) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const own = (dev as any).user_id === res.ctx.userRow.id;
  if (b.action === "revoke" && own) {
    // أي عضو ينهي جهازه الخاص
    await admin.from("login_devices").update({ revoked: true }).eq("id", b.id);
    return NextResponse.json({ ok: true });
  }
  if (!isOwner) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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
