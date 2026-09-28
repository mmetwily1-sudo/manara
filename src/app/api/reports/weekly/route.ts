import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/reports/weekly — ملخص آخر 7 أيام للمالك (محسوب لحظياً) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  try {
    const [students, pays, invs, complaints, refunds, subs] = await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student").gte("created_at", week),
      admin.from("payments").select("amount").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", week).limit(5000),
      admin.from("invoices").select("amount,paid").eq("tenant_id", tid).gte("created_at", week).limit(5000),
      admin.from("complaints").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "open"),
      admin.from("refunds").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "pending"),
      admin.from("submissions").select("id", { count: "exact", head: true }).eq("tenant_id", tid).gte("submitted_at", week),
    ]);
    const revenue = ((pays.data ?? []) as any[]).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const issued = ((invs.data ?? []) as any[]).reduce((s, v) => s + Number(v.amount ?? 0), 0);
    const collected = ((invs.data ?? []) as any[]).reduce((s, v) => s + Number(v.paid ?? 0), 0);
    return NextResponse.json({
      ok: true,
      week: {
        new_students: students.count ?? 0,
        revenue,
        invoices_issued: issued,
        invoices_collected: collected,
        homework_submitted: subs.count ?? 0,
        open_complaints: complaints.count ?? 0,
        pending_refunds: refunds.count ?? 0,
      },
    });
  } catch (e) {
    return dbFail("weekly-summary", e);
  }
}
