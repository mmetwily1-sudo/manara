import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** حساب التقدم الحالي لهدف من البيانات الحية */
async function currentOf(admin: any, tid: string, sid: string, kind: string): Promise<number> {
  try {
    if (kind === "points") {
      const { data } = await admin.from("users").select("points").eq("id", sid).eq("tenant_id", tid).single();
      return Number((data as any)?.points ?? 0) || 0;
    }
    if (kind === "attendance") {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { count } = await admin.from("attendance").select("id", { count: "exact", head: true })
        .eq("tenant_id", tid).eq("student_id", sid).eq("status", "present").gte("created_at", since);
      return count ?? 0;
    }
    if (kind === "exam_avg") {
      const { data: atts } = await admin.from("exam_attempts").select("score,exam_id")
        .eq("tenant_id", tid).eq("student_id", sid).order("submitted_at", { ascending: false }).limit(5);
      if (!atts?.length) return 0;
      let sum = 0, n = 0;
      for (const a of atts as any[]) {
        const { data: qs } = await admin.from("exam_questions").select("marks").eq("tenant_id", tid).eq("exam_id", a.exam_id).limit(200);
        const total = ((qs ?? []) as any[]).reduce((s, r) => s + Number(r.marks ?? 0), 0);
        if (total > 0) { sum += (Number(a.score ?? 0) / total) * 100; n++; }
      }
      return n ? Math.round(sum / n) : 0;
    }
  } catch {}
  return 0;
}

/** GET /api/goals?student_id= — أهداف طالب مع التقدم المحسوب */
export async function GET(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const sid = new URL(req.url).searchParams.get("student_id");
  if (!sid) return NextResponse.json({ ok: false, error: "student_required" }, { status: 400 });
  const { data } = await admin.from("student_goals").select("id,title,kind,target,deadline,status,created_at")
    .eq("tenant_id", tid).eq("student_id", sid).order("created_at", { ascending: false }).limit(50);
  const goals = [];
  for (const g of (data ?? []) as any[]) {
    const cur = g.status === "active" ? await currentOf(admin, tid, sid, g.kind) : 0;
    goals.push({ ...g, current: cur, pct: g.target > 0 ? Math.min(100, Math.round((cur / g.target) * 100)) : 0 });
  }
  return NextResponse.json({ ok: true, goals });
}

/** POST /api/goals {student_id,title,kind,target,deadline?} — هدف جديد (مالك + مشرف) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content, { req: req });
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.student_id || !String(b?.title ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "student_and_title_required" }, { status: 400 });
  }
  const kind = ["points", "attendance", "exam_avg"].includes(b?.kind) ? b.kind : "points";
  const { data: st } = await sb.from("users").select("id").eq("id", b.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { data, error } = await sb.from("student_goals").insert({
    tenant_id: tid, student_id: b.student_id, title: String(b.title).trim().slice(0, 120),
    kind, target: Math.max(1, Number(b.target) || 100), deadline: b.deadline || null,
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("goal-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}

/** PATCH /api/goals {id, status} — إنهاء/إلغاء هدف */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.content, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["done", "cancelled", "active"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("student_goals").update({ status: b.status })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("goal-update", error);
  return NextResponse.json({ ok: true });
}
