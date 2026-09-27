import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { R } from "@/lib/permissions";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaForUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); },
    },
  });
}

function getSlugFromHost() {
  const host = headers().get("host") ?? "";
  const h = host.split(":")[0].toLowerCase();
  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "manara.app";
  if (h === "localhost" || h === "127.0.0.1" || h === "lvh.me" || h.endsWith(".lvh.me")) {
    const slug = h.replace(/\.lvh\.me$/, "").split(".")[0];
    if (slug && slug !== "www" && slug !== "lvh") return slug;
    return null;
  }
  if (h === ROOT || h === `www.${ROOT}`) return null;
  if (!h.endsWith(`.${ROOT}`)) return null;
  return h.slice(0, -(ROOT.length + 1)).split(".")[0] || null;
}

export async function POST(req: Request) {
  if (!SUPA_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, fallback: true }, { status: 200 });
  }

  let body: { sessionId?: string; studentId?: string; status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }

  const { sessionId, studentId, status } = body as any;
  if (!sessionId || !studentId || !["present", "absent", "late"].includes(status)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const sbUser = supaForUser();
  const auth = sbUser ? await sbUser.auth.getUser() : { data: { user: null } };
  if (!auth.data.user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", auth.data.user.id).single();
  if (!urow?.tenant_id) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  // التحضير للطاقم فقط — الطالب لا يسجل حضور نفسه أو غيره
  if (!R.attendance.includes((urow as any).role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: sess } = await admin.from("sessions").select("id,tenant_id,group_id").eq("id", sessionId).single();
  if (!sess || sess.tenant_id !== urow.tenant_id) return NextResponse.json({ ok: false, error: "bad_session" }, { status: 403 });
  try {
    const { staffScope } = await import("@/lib/permissions");
    const scope = await staffScope(admin, urow.tenant_id, (urow as any).role, (urow as any).id);
    if (scope.groupIds && !scope.groupIds.includes((sess as any).group_id)) {
      return NextResponse.json({ ok: false, error: "wrong_branch" }, { status: 403 });
    }
  } catch {}

  // الطالب يجب أن ينتمي لنفس السنتر (منع تلويث سجلات سناتر أخرى)
  const { data: student } = await admin.from("users").select("id").eq("id", studentId).eq("tenant_id", urow.tenant_id).single();
  if (!student) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 403 });

  // مكافأة الحضور مرة واحدة فقط (إعادة التحضير لا تمنح مجدداً)
  const { data: prevAtt } = await admin.from("attendance").select("status")
    .eq("session_id", sessionId).eq("student_id", studentId).single();

  const { error } = await admin.from("attendance").upsert({
    tenant_id: urow.tenant_id,
    session_id: sessionId,
    student_id: studentId,
    status,
    method: "manual",
    recorded_by: urow.id,
  }, { onConflict: "session_id,student_id" });

  if (error) return dbFail("attendance", error);

  if (status === "present" && (!prevAtt || (prevAtt as any).status !== "present")) {
    const { awardPoints, POINTS } = await import("@/lib/gamification");
    await awardPoints(admin, urow.tenant_id, studentId, POINTS.present);
  }

  await admin.from("audit_log").insert({
    tenant_id: urow.tenant_id, actor_id: urow.id,
    action: `attendance:${status}`, entity_type: "attendance", entity_id: sessionId,
    details: { studentId, status },
  });

  // إشعار واتساب فوري عند الغياب (best-effort — لا يؤثر على الرد)
  if (status === "absent") {
    try {
      const { notifyStudent } = await import("@/lib/notify");
      const { data: sessFull } = await admin
        .from("sessions")
        .select("session_date,groups(name)")
        .eq("id", sessionId)
        .single();
      const gname = (sessFull as any)?.groups?.name ?? "";
      const label = `${gname ? gname + " — " : ""}${(sessFull as any)?.session_date ?? ""}`.trim() || "حصة اليوم";
      const { data: trow } = await admin.from("tenants").select("name").eq("id", urow.tenant_id).single();
      const centerName = (trow as any)?.name ?? "";
      await notifyStudent(admin, {
        tenantId: urow.tenant_id,
        studentId,
        event: { kind: "attendance_absent", studentName: "", centerName, sessionLabel: label },
        dedupeKey: `attendance:${sessionId}:${studentId}`,
      });
      // إنذار الغياب المبكر: 3 غيابات متتالية → تصعيد بملاحظة حمراء (مرة لكل سلسلة)
      try {
        const { data: last3 } = await admin.from("attendance")
          .select("status,sessions!inner(session_date)")
          .eq("tenant_id", urow.tenant_id).eq("student_id", studentId)
          .order("session_date", { foreignTable: "sessions", ascending: false }).limit(3);
        const rows = (last3 ?? []) as any[];
        if (rows.length >= 3 && rows.every((a) => a.status === "absent")) {
          await notifyStudent(admin, {
            tenantId: urow.tenant_id,
            studentId,
            event: {
              kind: "attendance_absent", studentName: "", centerName,
              sessionLabel: `⚠️ الغياب الثالث على التوالي — ${label} — برجاء التواصل الفوري مع الإدارة`,
            },
            dedupeKey: `absence-streak:${studentId}:${sessionId}`,
          });
        }
      } catch {}
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
