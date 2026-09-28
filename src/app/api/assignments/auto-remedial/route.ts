import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** POST /api/assignments/auto-remedial {group_id} — واجب علاجي للمتعثرين (لا تسليم/متوسط < 50) */
export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: g } = await admin.from("groups").select("id,name").eq("id", b?.group_id).eq("tenant_id", tid).single();
  if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });

  const { data: enr } = await admin.from("enrollments").select("student_id")
    .eq("tenant_id", tid).eq("group_id", (g as any).id).eq("status", "active").limit(500);
  const sids = ((enr ?? []) as any[]).map((e) => e.student_id);
  if (!sids.length) return NextResponse.json({ ok: false, error: "empty_group" }, { status: 400 });

  const { data: recent } = await admin.from("assignments").select("id")
    .eq("tenant_id", tid).eq("group_id", (g as any).id).order("created_at", { ascending: false }).limit(3);
  const aids = ((recent ?? []) as any[]).map((a) => a.id);
  let noSubmit = new Set<string>(sids);
  if (aids.length) {
    const { data: subs } = await admin.from("submissions").select("student_id,assignment_id")
      .in("assignment_id", aids).limit(2000);
    const counts: Record<string, number> = {};
    ((subs ?? []) as any[]).forEach((s) => { counts[s.student_id] = (counts[s.student_id] ?? 0) + 1; });
    noSubmit = new Set(sids.filter((id) => (counts[id] ?? 0) < Math.min(2, aids.length)));
  }
  const { data: atts } = await admin.from("exam_attempts").select("student_id,score")
    .eq("tenant_id", tid).in("student_id", sids).gte("submitted_at", new Date(Date.now() - 60 * 864e5).toISOString()).limit(5000);
  const sums: Record<string, { s: number; n: number }> = {};
  ((atts ?? []) as any[]).forEach((a) => {
    const e = (sums[a.student_id] ??= { s: 0, n: 0 });
    e.s += Number(a.score ?? 0); e.n++;
  });
  const weak = new Set(sids.filter((id) => sums[id] && sums[id].n >= 2 && sums[id].s / sums[id].n < 50));
  const atRisk = sids.filter((id) => noSubmit.has(id) || weak.has(id));
  if (!atRisk.length) return NextResponse.json({ ok: true, at_risk: [], created: false });

  const { data: us } = await admin.from("users").select("id,full_name").in("id", atRisk).limit(500);
  const names = ((us ?? []) as any[]).map((u) => String(u.full_name ?? "طالب").split(/\s+/)[0]);
  const due = new Date(Date.now() + 7 * 864e5);
  const { data: created, error } = await admin.from("assignments").insert({
    tenant_id: tid, group_id: (g as any).id,
    title: "خطة علاجية 🩹",
    description: `موجهة لـ: ${names.join("، ")} — مراجعة الأساسيات ثم التسليم قبل ${due.toISOString().slice(0, 10)}.`,
    due_at: due.toISOString(), max_score: 10, allow_late: true,
  }).select("id").single();
  if (error || !created) return dbFail("remedial-create", error);
  return NextResponse.json({ ok: true, created: true, id: (created as any).id, at_risk: names });
}
