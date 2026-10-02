import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R, staffScope } from "@/lib/permissions";
import { randomBytes, createHash } from "node:crypto";

/** GET /api/students?groupId= — طلاب السنتر مع مجموعاتهم (طاقم الفرع يرى طلاب فرعه) */
export async function GET(req: Request) {
  const res = await requireTeacher(R.studentsRead);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const groupId = new URL(req.url).searchParams.get("groupId");

  const { data: students, error } = await ctx.admin
    .from("users")
    .select("id,full_name,phone,created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return dbFail("students", error);

  const { data: enrolls } = await ctx.admin
    .from("enrollments")
    .select("student_id,group_id,status,groups(id,name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "active");

  const byStudent: Record<string, { id: string; name: string }[]> = {};
  (enrolls ?? []).forEach((e: any) => {
    if (!groupId || e.group_id === groupId) {
      (byStudent[e.student_id] ??= []).push({ id: e.group_id, name: e.groups?.name ?? "—" });
    }
  });

  let list = (students ?? []).map((s: any) => ({
    id: s.id, name: s.full_name, phone: s.phone, groups: byStudent[s.id] ?? [],
  }));
  if (groupId) list = list.filter((s: any) => s.groups.length > 0);
  const scope = await staffScope(ctx.admin, ctx.tenantId, res.ctx.userRow.role, res.ctx.userRow.id);
  if (scope.studentIds) list = list.filter((s: any) => scope.studentIds!.includes(s.id));

  return NextResponse.json({ ok: true, students: list });
}

/** POST /api/students — إضافة طالب (بدون حساب دخول؛ يُفعَّل عند تسجيله برقم الهاتف نفسه) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null as any);
  const name = (body?.name ?? "").trim();
  const { toAsciiDigits } = await import("@/lib/whatsapp");
  const phone = toAsciiDigits(body?.phone ?? "").replace(/[^\d+]/g, "");
  const groupId = (body?.groupId ?? "").trim() || null;

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  // منع تكرار نفس الرقم داخل نفس السنتر
  if (phone) {
    const { data: dup } = await ctx.admin
      .from("users")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("phone", phone)
      .limit(1);
    if (dup?.length) {
      return NextResponse.json({ ok: false, error: "phone_exists" }, { status: 400 });
    }
  }

  if (groupId) {
    const { data: g } = await ctx.admin.from("groups").select("id").eq("id", groupId).eq("tenant_id", ctx.tenantId).single();
    if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });
    const { isGroupFull } = await import("@/lib/capacity");
    if (await isGroupFull(ctx.admin, ctx.tenantId, groupId)) {
      return NextResponse.json({ ok: false, error: "group_full" }, { status: 409 });
    }
  }

  const { data: row, error } = await ctx.admin.from("users").insert({
    tenant_id: ctx.tenantId,
    auth_user_id: null,
    role: "student",
    full_name: name,
    phone: phone || null,
  }).select("id").single();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  if (groupId) {
    await ctx.admin.from("enrollments").insert({
      tenant_id: ctx.tenantId, student_id: row.id, group_id: groupId, status: "active",
    });
  }

  // ويبهوك تسجيل طالب (best-effort)
  try {
    const { fireWebhooks } = await import("@/lib/webhooks");
    await fireWebhooks(ctx.admin, ctx.tenantId, "student_registered", {
      student_id: (row as any).id, name, group_id: groupId,
    });
  } catch {} // eslint-disable-line no-empty

  // رابط ولي الأمر السحري — يتولد لحظة الإنشاء (سنة كاملة، بلا حساب ولا باسورد)
  let parentUrl: string | null = null;
  try {
    const token = randomBytes(24).toString("base64url");
    const tokenHash = createHash("sha256").update("parent:" + token).digest("hex");
    const expires = new Date(Date.now() + 365 * 864e5).toISOString();
    const { error: pErr } = await ctx.admin.from("parent_portal_sessions").insert({
      tenant_id: ctx.tenantId, parent_id: ctx.userRow.id, student_id: (row as any).id,
      token_hash: tokenHash, expires_at: expires,
    });
    if (!pErr) {
      const origin = new URL(req.url).origin;
      parentUrl = `${origin}/parent/enter?token=${token}`;
    }
  } catch {} // eslint-disable-line no-empty

  return NextResponse.json({ ok: true, id: row.id, parent_url: parentUrl });
}
