import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/payroll — مسيرات الرواتب مع البنود (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: runs, error } = await admin.from("payroll_runs")
    .select("id,month,status,approved_at,created_at").eq("tenant_id", tid)
    .order("month", { ascending: false }).limit(24);
  if (error) return dbFail("payroll-list", error);
  const rids = ((runs ?? []) as any[]).map((r) => r.id);
  let items: any[] = [];
  let names: Record<string, string> = {};
  if (rids.length) {
    const { data } = await admin.from("payroll_items")
      .select("run_id,user_id,base,bonus,deduction,net,note").in("run_id", rids).limit(1000);
    items = (data ?? []) as any[];
    const uids = Array.from(new Set(items.map((i) => i.user_id)));
    if (uids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", uids as string[]);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
  }
  return NextResponse.json({
    ok: true,
    runs: ((runs ?? []) as any[]).map((r) => ({
      ...r,
      total: items.filter((i) => i.run_id === r.id).reduce((s, i) => s + Number(i.net ?? 0), 0),
      items: items.filter((i) => i.run_id === r.id).map((i) => ({ ...i, name: names[i.user_id] ?? "" })),
    })),
  });
}

/** POST /api/payroll {month} — توليد مسير من العقود النشطة (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const month = String(b?.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ ok: false, error: "bad_month" }, { status: 400 });
  const { data: existing } = await admin.from("payroll_runs").select("id").eq("tenant_id", tid).eq("month", month).single();
  if (existing) return NextResponse.json({ ok: false, error: "exists" }, { status: 400 });
  const { data: contracts } = await admin.from("staff_contracts").select("user_id,salary_base")
    .eq("tenant_id", tid).eq("active", true).limit(500);
  if (!contracts?.length) return NextResponse.json({ ok: false, error: "no_contracts" }, { status: 400 });
  const { data: advs } = await admin.from("staff_advances").select("id,user_id,amount")
    .eq("tenant_id", tid).eq("status", "pending").limit(1000);
  const advByUser: Record<string, { ids: string[]; total: number }> = {};
  ((advs ?? []) as any[]).forEach((a) => {
    const e = (advByUser[a.user_id] ??= { ids: [], total: 0 });
    e.ids.push(a.id); e.total += Number(a.amount ?? 0);
  });
  const { data: run, error: re } = await admin.from("payroll_runs")
    .insert({ tenant_id: tid, month }).select("id").single();
  if (re || !run) return dbFail("payroll-create", re);
  const rows = (contracts as any[]).map((c) => {
    const adv = advByUser[c.user_id]?.total ?? 0;
    const base = Number(c.salary_base ?? 0);
    return {
      tenant_id: tid, run_id: (run as any).id, user_id: c.user_id,
      base, bonus: 0, deduction: adv, net: base - adv,
      note: adv > 0 ? `خصم سلفة: ${adv}` : "",
    };
  });
  const { error: ie } = await admin.from("payroll_items").insert(rows);
  if (ie) return dbFail("payroll-items", ie);
  const contracted = new Set((contracts as any[]).map((c) => c.user_id));
  const usedIds = Object.entries(advByUser)
    .filter(([uid]) => contracted.has(uid))
    .flatMap(([, e]) => (e as { ids: string[] }).ids);
  if (usedIds.length) {
    await admin.from("staff_advances").update({ status: "deducted" }).in("id", usedIds).eq("tenant_id", tid);
  }
  return NextResponse.json({ ok: true, id: (run as any).id });
}

/** PATCH /api/payroll {run_id, action: approve|item, user_id?, bonus?, deduction?, note?} */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const { data: run } = await admin.from("payroll_runs").select("id,status").eq("id", b?.run_id).eq("tenant_id", tid).single();
  if (!run) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (b?.action === "approve") {
    if ((run as any).status === "approved") return NextResponse.json({ ok: false, error: "already" }, { status: 400 });
    const { totpRequired, totpOk } = await import("@/lib/totp");
    if (await totpRequired(admin, res.ctx.userRow.id)) {
      if (!(await totpOk(admin, res.ctx.userRow.id, b?.totp))) {
        return NextResponse.json({ ok: false, error: "totp_required" }, { status: 403 });
      }
    }
    const { error } = await admin.from("payroll_runs").update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", b.run_id).eq("tenant_id", tid);
    if (error) return dbFail("payroll-approve", error);
    try {
      await admin.from("audit_log").insert({
        tenant_id: tid, actor_id: res.ctx.userRow.id,
        action: "payroll:approve", entity_type: "payroll_run", entity_id: b.run_id, details: {},
      });
    } catch {}
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "item") {
    if ((run as any).status === "approved") return NextResponse.json({ ok: false, error: "locked" }, { status: 400 });
    const bonus = Math.max(0, Number(b?.bonus ?? 0));
    const deduction = Math.max(0, Number(b?.deduction ?? 0));
    const { data: item } = await admin.from("payroll_items").select("base").eq("run_id", b.run_id).eq("user_id", b?.user_id).single();
    if (!item) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const net = Number((item as any).base ?? 0) + bonus - deduction;
    const { error } = await admin.from("payroll_items").update({ bonus, deduction, net, note: String(b?.note ?? "").slice(0, 200) })
      .eq("run_id", b.run_id).eq("user_id", b?.user_id);
    if (error) return dbFail("payroll-item", error);
    return NextResponse.json({ ok: true, net });
  }
  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
