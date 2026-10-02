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

/** GET /api/live — طالب: القادمة لمجموعاته | معلم: الكل + الحاضرون (?hands=sessionId للأيدي المرفوعة) */
export async function GET(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  const roomOf = (id: string) => "manara-" + String(id).replace(/-/g, "").slice(0, 20);
  const handsId = new URL(req.url).searchParams.get("hands");
  if (handsId) {
    if (!isTeacher) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const { data: hs } = await admin.from("live_hands").select("student_id,created_at")
      .eq("tenant_id", tid).eq("session_id", handsId).order("created_at", { ascending: true }).limit(50);
    const sids = ((hs ?? []) as any[]).map((h) => h.student_id);
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
    return NextResponse.json({ ok: true, hands: ((hs ?? []) as any[]).map((h) => ({ ...h, name: names[h.student_id] ?? "" })) });
  }
  let sessions: any[] = [];
  if (isTeacher) {
    const { data, error } = await admin.from("live_sessions").select("id,title,group_id,starts_at,join_url,active,provider,ext_url")
      .eq("tenant_id", tid).gte("starts_at", new Date(Date.now() - 864e5).toISOString())
      .order("starts_at", { ascending: true }).limit(50);
    if (error) return dbFail("live-list", error);
    sessions = (data ?? []) as any[];
    const sids = sessions.map((s) => s.id);
    let att: Record<string, number> = {};
    if (sids.length) {
      const { data: rows } = await admin.from("live_attendance").select("session_id")
        .eq("tenant_id", tid).in("session_id", sids).limit(5000);
      ((rows ?? []) as any[]).forEach((r) => { att[r.session_id] = (att[r.session_id] ?? 0) + 1; });
    }
    const gids = Array.from(new Set(sessions.map((s) => s.group_id).filter(Boolean)));
    let gnames: Record<string, string> = {};
    if (gids.length) {
      const { data: gs } = await admin.from("groups").select("id,name").in("id", gids as string[]);
      (gs ?? []).forEach((g: any) => { gnames[g.id] = g.name ?? ""; });
    }
    return NextResponse.json({
      ok: true, isTeacher,
      sessions: sessions.map((s) => ({ ...s, room: roomOf(s.id), group: s.group_id ? (gnames[s.group_id] ?? "") : "عام", present: att[s.id] ?? 0 })),
    });
  }
  const { data: en } = await admin.from("enrollments").select("group_id")
    .eq("tenant_id", tid).eq("student_id", urow.id).eq("status", "active");
  const gids = ((en ?? []) as any[]).map((e) => e.group_id);
  let q = admin.from("live_sessions").select("id,title,starts_at,join_url,provider,ext_url")
    .eq("tenant_id", tid).eq("active", true)
    .gte("starts_at", new Date(Date.now() - 2 * 3600e3).toISOString())
    .order("starts_at", { ascending: true }).limit(20);
  if (gids.length) q = q.or(`group_id.is.null,group_id.in.(${gids.join(",")})`);
  else q = q.is("group_id", null);
  const { data, error } = await q;
  if (error) return dbFail("live-student", error);
  return NextResponse.json({ ok: true, isTeacher, sessions: ((data ?? []) as any[]).map((s) => ({ ...s, room: roomOf(s.id) })) });
}

/** POST /api/live — معلم: جدولة {title, group_id?, starts_at, provider?, ext_url?} | طالب: حضور/رفع يد */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  const b = await req.json().catch(() => ({} as any));
  // رفع/إنزال اليد — قبل فرع الإنشاء (يعمل للمعلم والطالب)
  if (b?.action === "raise" && b?.session_id) {
    const { error } = await admin.from("live_hands").upsert(
      { tenant_id: tid, session_id: b.session_id, student_id: urow.id },
      { onConflict: "session_id,student_id" }
    );
    if (error) return dbFail("hand-raise", error);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "lower" && b?.session_id) {
    // المعلم ينزل أي يد (user_id) — الطالب ينزل يده فقط
    const target = isTeacher && b?.user_id ? String(b.user_id) : urow.id;
    const { error } = await admin.from("live_hands").delete()
      .eq("tenant_id", tid).eq("session_id", b.session_id).eq("student_id", target);
    if (error) return dbFail("hand-lower", error);
    return NextResponse.json({ ok: true });
  }
  if (isTeacher) {
    const provider = ["jitsi", "zoom", "link"].includes(b?.provider) ? b.provider : "jitsi";
    const extUrl = String(b?.ext_url ?? "").trim().slice(0, 500);
    if (!String(b?.title ?? "").trim() || !b?.starts_at) {
      return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
    }
    if (provider !== "jitsi" && !/^https?:\/\//i.test(extUrl)) {
      return NextResponse.json({ ok: false, error: "bad_url" }, { status: 400 });
    }
    if (b?.group_id) {
      const { data: g } = await admin.from("groups").select("id").eq("id", b.group_id).eq("tenant_id", tid).single();
      if (!g) return NextResponse.json({ ok: false, error: "bad_group" }, { status: 400 });
    }
    const { error } = await admin.from("live_sessions").insert({
      tenant_id: tid, title: String(b.title).slice(0, 150), group_id: b?.group_id || null,
      starts_at: new Date(b.starts_at).toISOString(),
      join_url: provider === "jitsi" ? "" : extUrl,
      provider, ext_url: provider === "jitsi" ? "" : extUrl,
    });
    if (error) return dbFail("live-create", error);
    return NextResponse.json({ ok: true });
  }
  const { data: s } = await admin.from("live_sessions").select("id")
    .eq("id", b?.attend).eq("tenant_id", tid).eq("active", true).single();
  if (!s) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { error } = await admin.from("live_attendance").upsert(
    { tenant_id: tid, session_id: (s as any).id, student_id: urow.id },
    { onConflict: "session_id,student_id" }
  );
  if (error) return dbFail("live-attend", error);
  return NextResponse.json({ ok: true });
}
