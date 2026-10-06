import { NextResponse } from "next/server";
import { resolveMeStudent } from "@/lib/student-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/me/recommendations — توصيات المدرّس الذكي للطالب الحالي (PIN أو حساب Supabase) */
export async function GET(req: Request) {
  const res = await resolveMeStudent(req);
  if ("error" in res) return res.error;
  const { admin, tenantId, studentId } = res;

  const { data: recs, error } = await admin
    .from("student_recommendations")
    .select("id,kind,subject,topic,message,priority,created_at")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .is("dismissed_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return dbFail("recommendations", error);

  const { data: profile } = await admin
    .from("student_learning_profile")
    .select("subject,trend,last_computed_at")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ok: true, recommendations: recs ?? [], profile: profile ?? null });
}

/** POST /api/me/recommendations { id } — الطالب يستبعد توصية رآها */
export async function POST(req: Request) {
  const res = await resolveMeStudent(req);
  if ("error" in res) return res.error;
  const { admin, tenantId, studentId } = res;
  const body = await req.json().catch(() => null as any);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  await admin.from("student_recommendations").update({ dismissed_at: new Date().toISOString() })
    .eq("id", id).eq("tenant_id", tenantId).eq("student_id", studentId);
  return NextResponse.json({ ok: true });
}
