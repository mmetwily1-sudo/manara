import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R, staffScope } from "@/lib/permissions";

const curPeriod = () => new Date().toISOString().slice(0, 7);

/** GET /api/invoices — الفواتير + كشف المتأخرات (طاقم الفرع لطلاب فرعه) */
export async function GET(req: Request) {
  const res = await requireTeacher(R.billingRead);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [scope, invRes, attRes] = await Promise.all([
    staffScope(admin, tid, res.ctx.userRow.role, res.ctx.userRow.id),
    admin.from("invoices")
      .select("id,student_id,group_id,period,amount,paid,status,receipt_no,paid_at")
      .eq("tenant_id", tid)
      .order("period", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    admin.from("attendance").select("student_id")
      .eq("tenant_id", tid).eq("status", "absent").gte("created_at", monthStart.toISOString()).limit(2000)
      .then((r: any) => r).catch(() => ({ data: [] })),
  ]);
  const allInv = (invRes as any)?.data;
  const inv = scope.studentIds
    ? (allInv ?? []).filter((x: any) => scope.studentIds!.includes(x.student_id))
    : (allInv ?? []);

  const sids = Array.from(new Set((inv ?? []).map((x: any) => x.student_id).filter(Boolean)));
  let people: Record<string, { name: string; phone: string | null }> = {};
  if (sids.length) {
    const { data: st } = await admin.from("users").select("id,full_name,phone").in("id", sids as string[]);
    (st ?? []).forEach((s: any) => { people[s.id] = { name: s.full_name, phone: s.phone ?? null }; });
  }
  // الغياب هذا الشهر لكل طالب (جُلب بالتوازي أعلاه — توصية Grok)
  let absences: Record<string, number> = {};
  ((attRes as any)?.data ?? []).forEach((a: any) => { absences[a.student_id] = (absences[a.student_id] ?? 0) + 1; });

  const bal: Record<string, { name: string; phone: string | null; due: number; periods: string[]; abs: number }> = {};
  (inv ?? []).forEach((x: any) => {
    if (x.status === "paid") return;
    const rest = Number(x.amount ?? 0) - Number(x.paid ?? 0);
    if (rest <= 0) return;
    const b = bal[x.student_id] ??= { name: people[x.student_id]?.name ?? "—", phone: people[x.student_id]?.phone ?? null, due: 0, periods: [], abs: 0 };
    b.due += rest;
    if (!b.periods.includes(x.period)) b.periods.push(x.period);
  });
  Object.keys(bal).forEach((sid) => { bal[sid].abs = absences[sid] ?? 0; });
  const overdues = Object.entries(bal).map(([sid, b]) => ({ student_id: sid, ...b }))
    .sort((a, b) => b.due - a.due).slice(0, 100);

  return NextResponse.json({
    ok: true,
    invoices: (inv ?? []).map((x: any) => ({ ...x, student: people[x.student_id]?.name ?? "—" })),
    overdues,
  });
}

/** POST /api/invoices {action:"issue", period?} — إصدار فواتير شهر (مالك + محاسب) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const body = await req.json().catch(() => ({} as any));
  if (body?.action !== "issue") return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  const period = /^\d{4}-\d{2}$/.test(String(body?.period ?? "")) ? String(body.period) : curPeriod();

  try {
    const { data: enr } = await admin.from("enrollments")
      .select("student_id,group_id,special_price,groups(monthly_fee)")
      .eq("tenant_id", tid).eq("status", "active").limit(2000);
    const rows = (enr ?? [])
      .map((e: any) => ({
        tenant_id: tid, student_id: e.student_id, group_id: e.group_id, period,
        amount: Number(e.special_price ?? e.groups?.monthly_fee ?? 0),
      }))
      .filter((r: any) => r.student_id && r.amount > 0);
    let created = 0;
    // دفعات صغيرة لتفادي حد الصفوف + تجاهل الموجود (unique)
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await admin.from("invoices").insert(chunk);
      if (!error) created += chunk.length;
      else {
        // إدخال فردي لمن تخطى التعارض
        for (const r of chunk) {
          const { error: e2 } = await admin.from("invoices").insert(r);
          if (!e2) created++;
        }
      }
    }
    // الفترات الأقدم غير المسددة → overdue
    await admin.from("invoices").update({ status: "overdue" })
      .eq("tenant_id", tid).eq("status", "unpaid").lt("period", curPeriod());
    try {
      await admin.from("audit_log").insert({
        tenant_id: tid, actor_id: res.ctx.userRow.id,
        action: "invoices:issue", entity_type: "invoice", entity_id: period, details: { created, period },
      });
    } catch {}
    return NextResponse.json({ ok: true, created, period });
  } catch (e: any) {
    return dbFail("invoices-issue", e);
  }
}
