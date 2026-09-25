import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { createHash, randomBytes } from "crypto";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // بلا 0/O/1/I لمنع الالتباس
function makeCode(): string {
  const b = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}
const hash = (c: string) => createHash("sha256").update("examcode:" + c).digest("hex");

/** GET — قائمة أكواد الامتحان (معلم فقط) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const { data: exam } = await admin.from("exams").select("id,title,require_code").eq("id", params.id).eq("tenant_id", tid).single();
  if (!exam) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: codes } = await admin.from("exam_codes")
    .select("id,student_id,code_hint,status,device_fp,ip,issued_at,started_at,expires_at,submitted_at")
    .eq("exam_id", params.id).eq("tenant_id", tid).order("issued_at", { ascending: false }).limit(500);
  const sids = Array.from(new Set((codes ?? []).map((c: any) => c.student_id).filter(Boolean)));
  let names: Record<string, string> = {};
  if (sids.length) {
    const { data: st } = await admin.from("users").select("id,full_name").in("id", sids);
    (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
  }
  return NextResponse.json({
    ok: true, require_code: !!(exam as any).require_code,
    codes: (codes ?? []).map((c: any) => ({ ...c, student: c.student_id ? (names[c.student_id] ?? "—") : "كود احتياطي" })),
  });
}

/** POST — توليد أكواد {student_ids?: string[], count?: number} — يعيد الأكواد الصريحة مرة واحدة فقط */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const { data: exam } = await admin.from("exams").select("id").eq("id", params.id).eq("tenant_id", tid).single();
  if (!exam) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  let studentIds: string[] = Array.isArray(body?.student_ids) ? body.student_ids.filter((s: any) => typeof s === "string").slice(0, 500) : [];
  const spares = Math.max(0, Math.min(200, Number(body?.count ?? 0) || 0));
  if (!studentIds.length && !spares) {
    // الافتراضي: كل طلاب السنتر النشطين
    const { data: st } = await admin.from("users").select("id").eq("tenant_id", tid).eq("role", "student").limit(500);
    studentIds = (st ?? []).map((s: any) => s.id);
  }
  if (!studentIds.length && !spares) return NextResponse.json({ ok: false, error: "no_students" }, { status: 400 });

  // تحقق انتماء الطلاب + تخطي من لديه كود نشط
  let validIds: string[] = [];
  if (studentIds.length) {
    const { data: st } = await admin.from("users").select("id").eq("tenant_id", tid).eq("role", "student").in("id", studentIds);
    validIds = (st ?? []).map((s: any) => s.id);
    const { data: existing } = await admin.from("exam_codes").select("student_id")
      .eq("exam_id", params.id).in("status", ["issued", "started"]).in("student_id", validIds);
    const has = new Set((existing ?? []).map((e: any) => e.student_id));
    validIds = validIds.filter((id) => !has.has(id));
  }

  const rows: any[] = [];
  const plain: { student_id: string | null; code: string }[] = [];
  const used = new Set<string>();
  const pushRow = (sid: string | null) => {
    let code = "";
    do { code = makeCode(); } while (used.has(code));
    used.add(code);
    plain.push({ student_id: sid, code });
    rows.push({
      tenant_id: tid, exam_id: params.id, student_id: sid,
      code_hash: hash(code), code_hint: code.slice(0, 2) + "••" + code.slice(-1),
      created_by: res.ctx.userRow.id,
    });
  };
  validIds.forEach((sid) => pushRow(sid));
  for (let i = 0; i < spares; i++) pushRow(null);
  if (!rows.length) return NextResponse.json({ ok: false, error: "all_have_codes" }, { status: 400 });

  const { error } = await admin.from("exam_codes").insert(rows);
  if (error) return dbFail("exam-codes", error);

  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "exam:codes_generate", entity_type: "exam", entity_id: params.id,
      details: { count: rows.length },
    });
  } catch {}
  // الأكواد الصريحة تظهر مرة واحدة — لا تُخزّن
  const names: Record<string, string> = {};
  if (validIds.length) {
    const { data: st } = await admin.from("users").select("id,full_name").in("id", validIds);
    (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
  }
  return NextResponse.json({
    ok: true, count: rows.length,
    codes: plain.map((p) => ({ student: p.student_id ? (names[p.student_id] ?? "—") : "احتياطي", code: p.code })),
  });
}

/** DELETE — سحب كود {code_id} */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const body = await req.json().catch(() => ({} as any));
  const codeId = String(body?.code_id ?? "");
  if (!codeId) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  const { error } = await admin.from("exam_codes").update({ status: "revoked" })
    .eq("id", codeId).eq("exam_id", params.id).eq("tenant_id", tid).in("status", ["issued", "started"]);
  if (error) return dbFail("exam-code-revoke", error);
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "exam:code_revoke", entity_type: "exam", entity_id: params.id, details: { codeId },
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
