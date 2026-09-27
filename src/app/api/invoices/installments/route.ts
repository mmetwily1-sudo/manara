import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/invoices/installments {student_id, title, total, parts, start_period?}
 * خطة تقسيط: N فواتير شهرية متتالية (تُحصّل وتُذكّر بالبنية القائمة).
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const total = Math.round(Number(b?.total) || 0);
  const parts = Math.min(24, Math.max(2, Number(b?.parts) || 3));
  const title = String(b?.title ?? "تقسيط").trim().slice(0, 120);
  if (!b?.student_id || total <= 0) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const { data: st } = await sb.from("users").select("id").eq("id", b.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });

  let start = new Date();
  if (/^\d{4}-\d{2}$/.test(String(b?.start_period ?? ""))) {
    start = new Date(`${b.start_period}-01T00:00:00Z`);
  }
  const base = Math.floor(total / parts);
  const rem = total - base * parts;
  const rows = [];
  for (let i = 0; i < parts; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    rows.push({
      tenant_id: tid, student_id: (st as any).id, group_id: null, period,
      amount: base + (i === parts - 1 ? rem : 0),
      note: `قسط ${i + 1}/${parts} — ${title}`,
    });
  }
  let created = 0;
  for (const r of rows) {
    const { error } = await sb.from("invoices").insert(r);
    if (!error) created++;
    else {
      // موجود مسبقاً؟ أضف الملاحظة للقائم بدل التخطي الصامت
      const { data: ex } = await sb.from("invoices").select("id,note").eq("tenant_id", tid)
        .eq("student_id", r.student_id).eq("period", r.period).limit(1).single();
      if (ex) {
        await sb.from("invoices").update({ note: `${(ex as any).note ?? ""} + ${r.note}`.slice(0, 300) }).eq("id", (ex as any).id);
        created++;
      }
    }
  }
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "installments:create", entity_type: "invoice", entity_id: (st as any).id,
      details: { total, parts, created },
    });
  } catch {}
  return NextResponse.json({ ok: true, created, parts, total });
}
