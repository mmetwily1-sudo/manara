import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** POST /api/me/delete {confirm: "احذف حسابي"} — إخفاء هوية الطالب وحذف دخوله */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role,auth_user_id")
    .eq("auth_user_id", user.id).single();
  if (!urow || (urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({} as any));
  if (String(b?.confirm ?? "") !== "احذف حسابي") {
    return NextResponse.json({ ok: false, error: "confirm_required" }, { status: 400 });
  }
  const sid = (urow as any).id;
  const tid = (urow as any).tenant_id;
  const { data: debt } = await admin.from("invoices").select("id")
    .eq("student_id", sid).neq("status", "paid").limit(1);
  if (debt?.length) {
    return NextResponse.json({ ok: false, error: "has_debt", message: "لديك فواتير غير مدفوعة — سددها أولاً." }, { status: 400 });
  }
  await admin.from("users").update({ full_name: "حساب محذوف", phone: null, points: 0 })
    .eq("id", sid).eq("tenant_id", tid);
  await admin.from("login_devices").update({ revoked: true }).eq("user_id", sid).eq("tenant_id", tid);
  try {
    if ((urow as any).auth_user_id) await admin.auth.admin.deleteUser((urow as any).auth_user_id);
  } catch {}
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: sid, action: "user:self_delete", entity_type: "user", entity_id: sid, details: {},
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
