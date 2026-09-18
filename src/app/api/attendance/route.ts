import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

  const { data: sess } = await admin.from("sessions").select("id,tenant_id,group_id").eq("id", sessionId).single();
  if (!sess || sess.tenant_id !== urow.tenant_id) return NextResponse.json({ ok: false, error: "bad_session" }, { status: 403 });

  // الطالب يجب أن ينتمي لنفس السنتر (منع تلويث سجلات سناتر أخرى)
  const { data: student } = await admin.from("users").select("id").eq("id", studentId).eq("tenant_id", urow.tenant_id).single();
  if (!student) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 403 });

  const { error } = await admin.from("attendance").upsert({
    tenant_id: urow.tenant_id,
    session_id: sessionId,
    student_id: studentId,
    status,
    method: "manual",
    recorded_by: urow.id,
  }, { onConflict: "session_id,student_id" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await admin.from("audit_log").insert({
    tenant_id: urow.tenant_id, actor_id: urow.id,
    action: `attendance:${status}`, entity_type: "attendance", entity_id: sessionId,
    details: { studentId, status },
  });

  return NextResponse.json({ ok: true });
}
