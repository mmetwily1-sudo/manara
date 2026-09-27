import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/bookings — حجوزات التجريبي والانتظار (مالك + مشرف) */
export async function GET() {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("trial_bookings")
    .select("id,name,phone,group_id,kind,status,note,created_at,groups(name)")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
  return NextResponse.json({ ok: true, bookings: data ?? [] });
}

/**
 * POST /api/bookings {name, phone, group_id?, kind?} — حجز عام بلا دخول (من صفحة المعلم).
 * ضد الإغراق: نفس الرقم + نفس السنتر + معلق = مرفوض.
 */
export async function POST(req: Request) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const b = await req.json().catch(() => ({} as any));
  const name = String(b?.name ?? "").trim().slice(0, 80);
  const phone = String(b?.phone ?? "").replace(/[^\d]/g, "");
  const teacherId = String(b?.teacher_id ?? "");
  const kind = b?.kind === "waitlist" ? "waitlist" : "trial";
  if (!name || phone.length < 10 || !teacherId) {
    return NextResponse.json({ ok: false, error: "name_phone_teacher_required" }, { status: 400 });
  }
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: t } = await admin.from("users").select("id,tenant_id").eq("id", teacherId)
    .in("role", ["teacher_admin", "supervisor", "assistant"]).single();
  if (!t) return NextResponse.json({ ok: false, error: "bad_teacher" }, { status: 404 });
  const tid = (t as any).tenant_id;
  let groupId: string | null = null;
  if (b?.group_id) {
    const { data: g } = await admin.from("groups").select("id").eq("id", b.group_id).eq("tenant_id", tid).single();
    if (g) groupId = (g as any).id;
  }
  const { count: dup } = await admin.from("trial_bookings").select("id", { count: "exact", head: true })
    .eq("tenant_id", tid).eq("phone", phone).eq("status", "pending");
  if ((dup ?? 0) > 0) return NextResponse.json({ ok: false, error: "already_pending" }, { status: 409 });
  const { error } = await admin.from("trial_bookings").insert({
    tenant_id: tid, name, phone, group_id: groupId, kind,
    note: String(b?.note ?? "").trim().slice(0, 300),
  });
  if (error) return dbFail("booking-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/bookings {id, status} — تأكيد/إلغاء/إتمام (طاقم) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["confirmed", "cancelled", "done"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_status" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("trial_bookings").update({ status: b.status })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("booking-update", error);
  return NextResponse.json({ ok: true });
}
