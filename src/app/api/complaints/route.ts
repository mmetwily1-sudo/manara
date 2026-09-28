import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role,full_name")
    .eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/complaints — طالب: شكاواي | معلم: الكل مع الأسماء + فلترة فئة/أولوية */
export async function GET(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const isTeacher = urow.role !== "student";
  const url = new URL(req.url);
  const catFilter = url.searchParams.get("category") || "";
  const priFilter = url.searchParams.get("priority") || "";
  let q = admin.from("complaints").select("id,student_id,kind,body,status,reply,category,priority,created_at")
    .eq("tenant_id", urow.tenant_id).order("priority", { ascending: true }).order("created_at", { ascending: false }).limit(200);
  if (!isTeacher) q = q.eq("student_id", urow.id);
  if (catFilter) q = q.eq("category", catFilter);
  if (priFilter) q = q.eq("priority", priFilter);
  const { data: rows, error } = await q;
  if (error) return dbFail("complaints-list", error);
  let names: Record<string, string> = {};
  if (isTeacher) {
    const sids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.student_id).filter(Boolean)));
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
  }
  return NextResponse.json({
    ok: true, isTeacher,
    open: ((rows ?? []) as any[]).filter((r) => r.status === "open").length,
    rows: ((rows ?? []) as any[]).map((r) => ({ ...r, student: names[r.student_id] ?? "" })),
  });
}

/** POST /api/complaints {kind, body} — طالب: شكوى/اقتراح جديد */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role !== "student") return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const kind = b?.kind === "suggestion" ? "suggestion" : "complaint";
  const body = String(b?.body ?? "").trim().slice(0, 1000);
  if (body.length < 5) return NextResponse.json({ ok: false, error: "too_short" }, { status: 400 });
  const { error } = await m.admin.from("complaints").insert({
    tenant_id: m.urow.tenant_id, student_id: m.urow.id, kind, body,
    ...(await import("@/lib/triage").then((t) => t.triageComplaint(body, kind))),
  });
  if (error) return dbFail("complaint-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/complaints {id, reply} — معلم: رد وإغلاق */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const reply = String(b?.reply ?? "").trim().slice(0, 1000);
  if (!b?.id || reply.length < 2) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const { error } = await m.admin.from("complaints").update({ reply, status: "resolved" })
    .eq("id", b.id).eq("tenant_id", m.urow.tenant_id);
  if (error) return dbFail("complaint-resolve", error);
  return NextResponse.json({ ok: true });
}
