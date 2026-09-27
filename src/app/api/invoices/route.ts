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

  const bal: Record<string, { name: string; phone: string | null; due: number; periods: string[]; abs: number; oldest: string }> = {};
  (inv ?? []).forEach((x: any) => {
    if (x.status === "paid") return;
    const rest = Number(x.amount ?? 0) - Number(x.paid ?? 0);
    if (rest <= 0) return;
    const b = bal[x.student_id] ??= { name: people[x.student_id]?.name ?? "—", phone: people[x.student_id]?.phone ?? null, due: 0, periods: [], abs: 0, oldest: x.period };
    b.due += rest;
    if (!b.periods.includes(x.period)) b.periods.push(x.period);
    if (String(x.period) < b.oldest) b.oldest = x.period;
  });
  Object.keys(bal).forEach((sid) => { bal[sid].abs = absences[sid] ?? 0; });
  const now = Date.now();
  const overdues = Object.entries(bal).map(([sid, b]) => {
    const oldestMs = new Date(`${b.oldest}-01T00:00:00Z`).getTime();
    const daysOverdue = Number.isFinite(oldestMs) ? Math.max(0, Math.floor((now - oldestMs) / 864e5)) : 0;
    // درجة ذكية: المبلغ + قِدم أقدم فترة + الغياب (الأعلى = أولوية التحصيل)
    const score = Math.round(b.due + daysOverdue * 10 + b.abs * 100);
    return { student_id: sid, ...b, daysOverdue, score, risk: score >= 5000 ? "high" : score >= 2000 ? "mid" : "low" };
  }).sort((a, b) => b.score - a.score).slice(0, 100);

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
    // كوبون خصم اختياري على الإصدار (يُستهلك مرة واحدة لكل إصدار)
    let pct = 0;
    const couponCode = String(body?.coupon_code ?? "").trim().toUpperCase();
    if (couponCode) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: cp } = await admin.from("coupons").select("id,pct,max_uses,used,expires_at")
        .eq("tenant_id", tid).eq("code", couponCode).eq("is_active", true).single();
      if ((cp as any) && Number((cp as any).used ?? 0) < Number((cp as any).max_uses ?? 0)
        && (!(cp as any).expires_at || String((cp as any).expires_at) >= today)) {
        pct = Number((cp as any).pct);
        await admin.from("coupons").update({ used: Number((cp as any).used ?? 0) + 1 }).eq("id", (cp as any).id);
      } else {
        return NextResponse.json({ ok: false, error: "bad_coupon" }, { status: 400 });
      }
    }
    const { data: enr } = await admin.from("enrollments")
      .select("student_id,group_id,special_price,groups(monthly_fee)")
      .eq("tenant_id", tid).eq("status", "active").limit(2000);
    const rows = (enr ?? [])
      .map((e: any) => {
        const base = Number(e.special_price ?? e.groups?.monthly_fee ?? 0);
        return {
          tenant_id: tid, student_id: e.student_id, group_id: e.group_id, period,
          amount: pct > 0 ? Math.max(1, Math.round(base * (100 - pct) / 100)) : base,
        };
      })
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
    return NextResponse.json({ ok: true, created, period, coupon_pct: pct });
  } catch (e: any) {
    return dbFail("invoices-issue", e);
  }
}
