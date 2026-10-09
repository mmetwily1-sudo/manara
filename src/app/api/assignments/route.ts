import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * GET /api/assignments — واجبات السنتر مع عدّادات التسليم (معلم).
 * POST /api/assignments { group_id, title, description?, due_at?, max_score? } — إنشاء واجب.
 */
export async function GET() {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { data: list, error } = await admin
    .from("assignments")
    .select("id,group_id,title,description,due_at,max_score,allow_late,created_at,groups(name)")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return dbFail("assignments-list", error);

  const ids = ((list ?? []) as any[]).map((a) => a.id);
  let counts: Record<string, { total: number; graded: number }> = {};
  if (ids.length) {
    const { data: subs } = await admin.from("submissions").select("assignment_id,status").in("assignment_id", ids);
    for (const s of (subs ?? []) as any[]) {
      const c = (counts[s.assignment_id] ??= { total: 0, graded: 0 });
      c.total++;
      if (s.status === "graded") c.graded++;
    }
  }
  return NextResponse.json({
    ok: true,
    assignments: ((list ?? []) as any[]).map((a) => ({
      ...a,
      group_name: (a.groups as any)?.name ?? null,
      submitted: counts[a.id]?.total ?? 0,
      graded: counts[a.id]?.graded ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content, { req: req });
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { isRateLimited } = await import("@/lib/rate-limit");
  if (await isRateLimited(req, "assignment-create", 30, 60 * 60 * 1000, tid)) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "تجاوزت حد إنشاء الواجبات (30/ساعة)." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as any));
  const title = String(body.title ?? "").trim().slice(0, 200);
  if (!body.group_id || title.length < 2) {
    return NextResponse.json({ ok: false, error: "bad_request", message: "اختر المجموعة واكتب عنواناً." }, { status: 400 });
  }
  // المجموعة من نفس السنتر
  const { data: g } = await admin.from("groups").select("id").eq("id", body.group_id).eq("tenant_id", tid).single();
  if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });

  const maxScore = Math.min(1000, Math.max(1, Number(body.max_score ?? 10) || 10));
  const dueAt = body.due_at ? new Date(String(body.due_at)) : null;
  const { data, error } = await admin.from("assignments").insert({
    tenant_id: tid,
    group_id: body.group_id,
    title,
    description: String(body.description ?? "").trim().slice(0, 2000) || null,
    due_at: dueAt && !isNaN(dueAt.getTime()) ? dueAt.toISOString() : null,
    max_score: maxScore,
    answer_key: String(body.answer_key ?? "").trim().slice(0, 2000),
  }).select("id").single();
  if (error) return dbFail("assignment-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}
