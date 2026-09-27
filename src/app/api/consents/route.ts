import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/consents?student_id= — موافقات طالب (طاقم) */
export async function GET(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const sid = new URL(req.url).searchParams.get("student_id");
  let q = res.ctx.admin.from("parent_consents")
    .select("id,student_id,title,body,status,decided_at,created_at,users(full_name)")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(100);
  if (sid) q = q.eq("student_id", sid);
  const { data } = await q;
  return NextResponse.json({ ok: true, consents: data ?? [] });
}

/** POST /api/consents {student_id,title,body?} — طلب موافقة + رابط موقع (مالك + مشرف) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const title = String(b?.title ?? "").trim().slice(0, 120);
  if (!b?.student_id || !title) return NextResponse.json({ ok: false, error: "student_and_title_required" }, { status: 400 });
  const { data: st } = await sb.from("users").select("id").eq("id", b.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { data, error } = await sb.from("parent_consents").insert({
    tenant_id: tid, student_id: b.student_id, title,
    body: String(b?.body ?? "").trim().slice(0, 2000), created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("consent-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id, link: `/c/${(data as any).id}` });
}
