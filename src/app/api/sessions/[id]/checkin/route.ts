import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/sessions/[id]/checkin {card_id, k} — تسجيل ذاتي عام برمز QR الدوّار.
 * بلا دخول: السر 90 ثانية + مطابقة لاحقة البطاقة + قيد نشط بالمجموعة.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const b = await req.json().catch(() => ({} as any));
  const suffix = String(b?.card_id ?? "").trim().slice(-8).toLowerCase();
  const k = String(b?.k ?? "").trim();
  if (!suffix || !k) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });

  const { data: s } = await admin.from("sessions").select("id,tenant_id,group_id,qr_secret,qr_expires_at")
    .eq("id", params.id).single();
  if (!s || (s as any).qr_secret !== k) return NextResponse.json({ ok: false, error: "bad_code" }, { status: 403 });
  if ((s as any).qr_expires_at && new Date((s as any).qr_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 410 });
  }
  const tid = (s as any).tenant_id;
  const { data: enr } = await admin.from("enrollments").select("student_id,users(id,full_name)")
    .eq("tenant_id", tid).eq("group_id", (s as any).group_id).eq("status", "active").limit(500);
  const hit = ((enr ?? []) as any[]).find((e) => String(e.student_id).toLowerCase().endsWith(suffix));
  if (!hit) return NextResponse.json({ ok: false, error: "not_enrolled" }, { status: 404 });
  const { data: sus } = await admin.from("users").select("suspended_until").eq("id", hit.student_id).single();
  if ((sus as any)?.suspended_until && String((sus as any).suspended_until) >= new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ ok: false, error: "suspended" }, { status: 403 });
  }

  await admin.from("attendance").upsert({
    tenant_id: tid, session_id: params.id, student_id: hit.student_id,
    status: "present", method: "qr_self",
  }, { onConflict: "session_id,student_id" });
  try {
    const { awardPoints, POINTS } = await import("@/lib/gamification");
    await awardPoints(admin, tid, hit.student_id, POINTS.present);
  } catch {}
  const first = String((hit.users as any)?.full_name ?? "طالب").split(/\s+/)[0];
  return NextResponse.json({ ok: true, student: first });
}
