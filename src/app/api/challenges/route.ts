import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/challenges — التحديات المفتوحة مع متصدريها (طاقم) */
export async function GET() {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: chs } = await admin.from("challenges")
    .select("id,title,target_points,group_id,deadline,status,winner_id,groups(name)")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(50);
  const out = [];
  for (const c of (chs ?? []) as any[]) {
    let ids: string[] | null = null;
    if (c.group_id) {
      const { data: enr } = await admin.from("enrollments").select("student_id")
        .eq("tenant_id", tid).eq("group_id", c.group_id).eq("status", "active").limit(500);
      ids = ((enr ?? []) as any[]).map((e) => e.student_id);
    }
    let q = admin.from("users").select("id,full_name,points").eq("tenant_id", tid).eq("role", "student")
      .order("points", { ascending: false }).limit(3);
    if (ids) q = ids.length ? q.in("id", ids) : q.in("id", ["00000000-0000-0000-0000-000000000000"]);
    const { data: top } = await q;
    out.push({
      id: c.id, title: c.title, target: c.target_points, group: (c.groups as any)?.name ?? null,
      deadline: c.deadline, status: c.status,
      top: ((top ?? []) as any[]).map((s, i) => ({ rank: i + 1, name: String(s.full_name ?? "طالب").split(/\s+/)[0], points: Number(s.points ?? 0) || 0 })),
    });
  }
  return NextResponse.json({ ok: true, challenges: out });
}

/** POST /api/challenges {title, target_points?, group_id?, deadline?} — تحدٍ جديد (مالك + مشرف) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const title = String(b?.title ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
  const { data, error } = await res.ctx.admin.from("challenges").insert({
    tenant_id: res.ctx.tenantId, title,
    target_points: Math.max(10, Number(b?.target_points) || 100),
    group_id: b?.group_id || null, deadline: b?.deadline || null,
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("challenge-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/challenges {id, status} — إغلاق التحدي (مالك + مشرف) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["closed", "open"].includes(b?.status)) return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  const { error } = await res.ctx.admin.from("challenges").update({ status: b.status })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("challenge-update", error);
  return NextResponse.json({ ok: true });
}
