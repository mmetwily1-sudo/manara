import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role")
    .eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/projects — طالب: مشاريعي + المعتمدة المميزة | معلم: الكل + الأسماء */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  let q = admin.from("projects").select("id,student_id,title,description,link,status,featured,created_at")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(200);
  if (!isTeacher) q = q.or(`student_id.eq.${urow.id},and(status.eq.approved,featured.eq.true)`);
  const { data: rows, error } = await q;
  if (error) return dbFail("projects-list", error);
  const sids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.student_id)));
  let names: Record<string, string> = {};
  if (sids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  return NextResponse.json({
    ok: true, isTeacher,
    rows: ((rows ?? []) as any[]).map((r) => ({ ...r, student: names[r.student_id] ?? "" })),
  });
}

/** POST /api/projects {title, description?, link?} — طالب: تقديم مشروع */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role !== "student") return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!String(b?.title ?? "").trim()) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const link = String(b?.link ?? "").trim().slice(0, 500);
  if (link && !/^https?:\/\//i.test(link)) return NextResponse.json({ ok: false, error: "bad_link" }, { status: 400 });
  const { error } = await m.admin.from("projects").insert({
    tenant_id: m.urow.tenant_id, student_id: m.urow.id,
    title: String(b.title).slice(0, 150), description: String(b?.description ?? "").slice(0, 2000), link,
  });
  if (error) return dbFail("project-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/projects {id, status?, featured?} — معلم: اعتماد/رفض/تمييز */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const patch: any = {};
  if (["approved", "rejected"].includes(b?.status)) patch.status = b.status;
  if (typeof b?.featured === "boolean") patch.featured = b.featured;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  const { error } = await m.admin.from("projects").update(patch)
    .eq("id", b.id).eq("tenant_id", m.urow.tenant_id);
  if (error) return dbFail("project-review", error);
  return NextResponse.json({ ok: true });
}
