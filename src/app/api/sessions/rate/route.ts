import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/** GET /api/sessions/rate — حصص اليوم غير المقيّمة لطالب (للتقييم) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow || (urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  }
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;
  const today = new Date().toISOString().slice(0, 10);
  const { data: enr } = await admin.from("enrollments").select("group_id").eq("tenant_id", tid).eq("student_id", sid).eq("status", "active").limit(50);
  const gids = ((enr ?? []) as any[]).map((e) => e.group_id);
  if (!gids.length) return NextResponse.json({ ok: true, sessions: [] });
  const { data: sess } = await admin.from("sessions").select("id,topic,group_id,groups(name)")
    .eq("tenant_id", tid).in("group_id", gids).eq("session_date", today).limit(20);
  const sids = ((sess ?? []) as any[]).map((s) => s.id);
  let rated = new Set<string>();
  if (sids.length) {
    const { data: rr } = await admin.from("session_ratings").select("session_id").eq("student_id", sid).in("session_id", sids);
    rated = new Set(((rr ?? []) as any[]).map((r) => r.session_id));
  }
  return NextResponse.json({
    ok: true,
    sessions: ((sess ?? []) as any[]).filter((s) => !rated.has(s.id))
      .map((s) => ({ id: s.id, topic: s.topic, group: (s.groups as any)?.name ?? "" })),
  });
}

/**
 * POST /api/sessions/rate {session_id, score} — تقييم الطالب للحصة 1-5 (مرة واحدة).
 * التسجيل مفتوح 48 ساعة بعد الحصة فقط.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow || (urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({} as any));
  const score = Number(b?.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ ok: false, error: "bad_score" }, { status: 400 });
  }
  const myId = (urow as any).id;
  const myTid = (urow as any).tenant_id;
  const { data: s } = await admin.from("sessions").select("id,tenant_id,session_date,group_id").eq("id", b?.session_id).single();
  if (!s || (s as any).tenant_id !== myTid) return NextResponse.json({ ok: false, error: "bad_session" }, { status: 404 });
  if (Date.now() - new Date((s as any).session_date).getTime() > 48 * 3600 * 1000) {
    return NextResponse.json({ ok: false, error: "closed" }, { status: 400 });
  }
  // مقيد بمجموعاته فقط
  const { data: enr } = await admin.from("enrollments").select("id").eq("tenant_id", myTid)
    .eq("student_id", myId).eq("group_id", (s as any).group_id).eq("status", "active").limit(1).single();
  if (!enr) return NextResponse.json({ ok: false, error: "not_yours" }, { status: 403 });
  const { error } = await admin.from("session_ratings").upsert({
    tenant_id: myTid, session_id: (s as any).id, student_id: myId, score,
  }, { onConflict: "session_id,student_id" });
  if (error) return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
