import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/backup/export — نسخة احتياطية ذاتية JSON بضغطة (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const dump: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    tenant_id: tid,
  };
  const tables: [string, string, number][] = [
    ["users", "id,full_name,phone,role,points,created_at", 3000],
    ["groups", "id,name,grade_level,subject,monthly_fee,capacity", 500],
    ["enrollments", "student_id,group_id,status", 5000],
    ["attendance", "student_id,session_id,status,created_at", 5000],
    ["payments", "student_id,amount,method,status,paid_at,receipt_no", 3000],
    ["invoices", "student_id,period,amount,paid,status", 3000],
    ["exams", "id,title,is_published,created_at", 500],
    ["questions", "id,subject,lesson,difficulty,qtype,body,marks", 2000],
    ["message_templates", "key,channel,title,body", 100],
    ["coupons", "code,pct,used,max_uses", 200],
  ];
  for (const [t, cols, lim] of tables) {
    try {
      const { data } = await admin.from(t).select(cols).eq("tenant_id", tid).limit(lim);
      dump[t] = data ?? [];
    } catch { dump[t] = []; }
  }
  try {
    await admin.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "backup:self_export", entity_type: "tenant", entity_id: tid, details: {},
    });
  } catch {}
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dump), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=manara-backup-${day}.json`,
    },
  });
}
