import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hash = (c: string) => createHash("sha256").update("examcode:" + c).digest("hex");

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, { cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } } });
}
function admin() {
  return createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/**
 * POST /api/exams/[id]/claim {code, device_fp?} — الطالب يستهلك كوده ويفتح جلسة واحدة.
 * - issued → started (ذرّي: UPDATE ... WHERE status='issued') + expires_at من السيرفر
 * - started + نفس الجهاز + ساري → استئناف (انقطاع النت/الكهرباء آمن)
 * - started + جهاز مختلف → 409 (تواصل مع معلمك) — تحذير لا حظر أعمى
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const sb = admin();

  const body = await req.json().catch(() => ({} as any));
  const code = String(body?.code ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  const fp = String(body?.device_fp ?? "").slice(0, 128) || null;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 64) || null;
  if (!code || code.length < 4) return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });

  const { data: exam } = await sb.from("exams")
    .select("id,tenant_id,duration_minutes,is_published").eq("id", params.id).single();
  if (!exam) return NextResponse.json({ ok: false, error: "exam_not_found" }, { status: 404 });
  if (!(exam as any).is_published) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let { data: urow } = await sb.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (urow && (urow as any).tenant_id !== (exam as any).tenant_id) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!urow) {
    // تسجيل تلقائي كطالب (نفس سياسة التسليم) — يُربط بالكود الاحتياطي فقط
    const meta = (user.user_metadata ?? {}) as any;
    const { data: created } = await sb.from("users").insert({
      tenant_id: (exam as any).tenant_id, auth_user_id: user.id, role: "student",
      full_name: meta.full_name ?? user.email?.split("@")[0] ?? "طالب", phone: meta.phone ?? null,
    }).select("id,tenant_id,role").single();
    urow = created as any;
    if (!urow) return NextResponse.json({ ok: false, error: "enroll_failed" }, { status: 500 });
  }
  const sid = (urow as any).id;

  const { data: row } = await sb.from("exam_codes").select("*")
    .eq("exam_id", params.id).eq("tenant_id", (exam as any).tenant_id).eq("code_hash", hash(code)).single();
  if (!row) return NextResponse.json({ ok: false, error: "bad_code" }, { status: 404 });
  if ((row as any).status === "revoked") return NextResponse.json({ ok: false, error: "revoked" }, { status: 410 });
  if ((row as any).status === "submitted" || (row as any).status === "expired") {
    return NextResponse.json({ ok: false, error: "used" }, { status: 410 });
  }
  if ((row as any).student_id && (row as any).student_id !== sid) {
    return NextResponse.json({ ok: false, error: "not_yours" }, { status: 403 });
  }

  const now = new Date();
  if ((row as any).status === "started") {
    // استئناف: نفس الجهاز + ساري
    if ((row as any).expires_at && new Date((row as any).expires_at) < now) {
      await sb.from("exam_codes").update({ status: "expired" }).eq("id", (row as any).id);
      return NextResponse.json({ ok: false, error: "expired" }, { status: 410 });
    }
    if ((row as any).device_fp && fp && (row as any).device_fp !== fp) {
      return NextResponse.json({ ok: false, error: "code_in_use", message: "الكود مستخدم على جهاز آخر — تواصل مع معلمك." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, resumed: true, expires_at: (row as any).expires_at });
  }

  // issued → started (ذرّي ضد السباق): ينجح واحد فقط
  const mins = Math.max(1, Math.min(180, Number((exam as any).duration_minutes ?? 30)));
  const exp = new Date(now.getTime() + mins * 60 * 1000).toISOString();
  const upd: any = { status: "started", started_at: now.toISOString(), expires_at: exp, ip };
  if (fp) upd.device_fp = fp;
  if (!(row as any).student_id) upd.student_id = sid; // ربط الكود الاحتياطي بأول مستخدم
  else {
    // تأكد: لا جلسة نشطة أخرى لنفس الطالب (دفاع إضافي بجانب الـpartial index)
    const { data: other } = await sb.from("exam_codes").select("id").eq("exam_id", params.id)
      .eq("student_id", sid).eq("status", "started").neq("id", (row as any).id).limit(1);
    if (other?.length) return NextResponse.json({ ok: false, error: "already_started" }, { status: 409 });
  }
  const { data: claimed } = await sb.from("exam_codes").update(upd)
    .eq("id", (row as any).id).eq("status", "issued").select("id,expires_at").single();
  if (!claimed) {
    // سباق: شخص آخر استهلكه — أعد القراءة
    const { data: fresh } = await sb.from("exam_codes").select("status,student_id,device_fp,expires_at").eq("id", (row as any).id).single();
    if ((fresh as any)?.status === "started" && (!(fresh as any).student_id || (fresh as any).student_id === sid)) {
      return NextResponse.json({ ok: true, resumed: true, expires_at: (fresh as any).expires_at });
    }
    return NextResponse.json({ ok: false, error: "taken" }, { status: 409 });
  }
  try {
    await sb.from("audit_log").insert({
      tenant_id: (exam as any).tenant_id, actor_id: sid,
      action: "exam:code_claim", entity_type: "exam", entity_id: params.id, details: { codeId: (row as any).id },
    });
  } catch {}
  return NextResponse.json({ ok: true, resumed: false, expires_at: exp });
}
