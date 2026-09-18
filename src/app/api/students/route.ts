import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/students?groupId= — طلاب السنتر مع مجموعاتهم */
export async function GET(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
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
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

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

  return NextResponse.json({ ok: true, students: list });
}

/** POST /api/students — إضافة طالب (بدون حساب دخول؛ يُفعَّل عند تسجيله برقم الهاتف نفسه) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null as any);
  const name = (body?.name ?? "").trim();
  const phone = (body?.phone ?? "").replace(/[^\d+]/g, "");
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

  return NextResponse.json({ ok: true, id: row.id });
}
