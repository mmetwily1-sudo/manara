import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/grades/import {exam_id, rows:[{student, score}]} — استيراد درجات ورقية بالجملة.
 * student: اسم أو هاتف أو id. upsert على (exam_id, student_id) — لا يمسح محاولات الأونلاين الأعلى.
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content, { req: req });
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: ex } = await sb.from("exams").select("id,title").eq("id", b?.exam_id).eq("tenant_id", tid).single();
  if (!ex) return NextResponse.json({ ok: false, error: "bad_exam" }, { status: 404 });
  const rows = Array.isArray(b?.rows) ? b.rows.slice(0, 500) : [];
  if (!rows.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const { data: students } = await sb.from("users").select("id,full_name,phone")
    .eq("tenant_id", tid).eq("role", "student").limit(2000);
  const byId = new Map(((students ?? []) as any[]).map((s) => [s.id, s]));
  const byPhone = new Map(((students ?? []) as any[]).map((s) => [String(s.phone ?? "").replace(/[^\d]/g, ""), s]));
  const byName = new Map(((students ?? []) as any[]).map((s) => [String(s.full_name ?? "").trim(), s]));

  let imported = 0;
  const missing: string[] = [];
  for (const r of rows) {
    const key = String(r?.student ?? "").trim();
    const score = Number(r?.score);
    if (!key || !Number.isFinite(score) || score < 0) continue;
    const st = byId.get(key) ?? byPhone.get(key.replace(/[^\d]/g, "")) ?? byName.get(key);
    if (!st) { if (missing.length < 20) missing.push(key); continue; }
    try {
      const { data: prev } = await sb.from("exam_attempts").select("id,score")
        .eq("exam_id", b.exam_id).eq("student_id", st.id).single();
      if (prev && Number((prev as any).score ?? 0) >= score) continue; // لا نخفض درجة أونلاين أعلى
      const { error } = await sb.from("exam_attempts").upsert({
        tenant_id: tid, exam_id: b.exam_id, student_id: st.id,
        answers: { imported: true }, score, submitted_at: new Date().toISOString(),
      }, { onConflict: "exam_id,student_id" });
      if (!error) imported++;
    } catch {}
  }
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "grades:import", entity_type: "exam", entity_id: b.exam_id, details: { imported, missing: missing.length },
    });
  } catch {}
  return NextResponse.json({ ok: true, imported, missing });
}
