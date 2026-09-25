import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { STAFF_ROLES } from "@/lib/permissions";

const ROLE_LABEL: Record<string, string> = { supervisor: "مشرف", assistant: "مساعد تحضير", accountant: "محاسب" };

/** GET /api/staff — طاقم السنتر (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("users").select("id,full_name,phone,role,branch_id,created_at")
    .eq("tenant_id", res.ctx.tenantId).in("role", ["teacher_admin", ...STAFF_ROLES]).order("created_at", { ascending: true }).limit(100);
  let branches: Record<string, string> = {};
  const bids = Array.from(new Set((data ?? []).map((u: any) => u.branch_id).filter(Boolean)));
  if (bids.length) {
    const { data: bs } = await res.ctx.admin.from("branches").select("id,name").in("id", bids as string[]);
    (bs ?? []).forEach((b: any) => { branches[b.id] = b.name; });
  }
  return NextResponse.json({
    ok: true,
    staff: (data ?? []).map((u: any) => ({
      id: u.id, name: u.full_name, phone: u.phone, role: u.role,
      role_label: u.role === "teacher_admin" ? "المالك" : (ROLE_LABEL[u.role] ?? u.role),
      branch: u.branch_id ? (branches[u.branch_id] ?? "—") : "كل الفروع",
      is_owner: u.id === res.ctx.userRow.id,
    })),
  });
}

/** POST /api/staff {email,password,full_name,phone,role,branch_id?} — دعوة عضو (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const body = await req.json().catch(() => ({} as any));

  const role = String(body?.role ?? "");
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ ok: false, error: "bad_role" }, { status: 400 });
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const fullName = String(body?.full_name ?? "").trim().slice(0, 80);
  const phone = String(body?.phone ?? "").replace(/[^\d+]/g, "");
  if (!email.includes("@") || password.length < 8 || fullName.length < 2 || phone.length < 8) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  let branchId: string | null = null;
  if (body?.branch_id) {
    const { data: br } = await admin.from("branches").select("id").eq("id", body.branch_id).eq("tenant_id", tid).single();
    if (!br) return NextResponse.json({ ok: false, error: "bad_branch" }, { status: 400 });
    branchId = body.branch_id;
  }
  const { data: au, error: ae } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName, role, phone },
  });
  if (ae || !au?.user) {
    return NextResponse.json({ ok: false, error: "auth_failed", message: (ae as any)?.message ?? "" }, { status: 400 });
  }
  const { error: ue } = await admin.from("users").insert({
    tenant_id: tid, auth_user_id: au.user.id, role, full_name: fullName, phone, branch_id: branchId,
  });
  if (ue) {
    await admin.auth.admin.deleteUser(au.user.id).catch(() => {});
    return NextResponse.json({ ok: false, error: "profile_failed", message: (ue as any)?.message ?? "" }, { status: 400 });
  }
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: `staff:invite:${role}`, entity_type: "user", entity_id: au.user.id, details: { email },
    });
  } catch {}
  return NextResponse.json({ ok: true });
}

/** DELETE /api/staff?id= — إزالة عضو (مالك فقط، ليس نفسه ولا مالكاً آخر) */
export async function DELETE(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || id === res.ctx.userRow.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { data: target } = await admin.from("users").select("id,role,auth_user_id")
    .eq("id", id).eq("tenant_id", res.ctx.tenantId).single();
  if (!target || (target as any).role === "teacher_admin") {
    return NextResponse.json({ ok: false, error: "protected" }, { status: 400 });
  }
  await admin.from("users").delete().eq("id", id);
  if ((target as any).auth_user_id) await admin.auth.admin.deleteUser((target as any).auth_user_id).catch(() => {});
  return NextResponse.json({ ok: true });
}
