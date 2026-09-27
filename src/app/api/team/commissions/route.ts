import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

/** GET /api/team/commissions — عمولة كل مدرس = نسبة من تحصيل مجموعاته (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: t }, { data: groups }, { data: pay }, { data: staff }] = await Promise.all([
    admin.from("tenants").select("settings").eq("id", tid).single(),
    admin.from("groups").select("id,name,teacher_id").eq("tenant_id", tid).limit(200),
    admin.from("payments").select("amount,group_id").eq("tenant_id", tid).eq("status", "confirmed").gte("paid_at", monthAgo).limit(3000),
    admin.from("users").select("id,full_name").eq("tenant_id", tid).in("role", ["teacher_admin", "supervisor", "assistant"]).limit(100),
  ]);
  const rate = Math.min(50, Math.max(0, Number((t as any)?.settings?.commission_pct ?? 10)));
  const smap = new Map(((staff ?? []) as any[]).map((s: any) => [s.id, s.full_name]));
  const per: Record<string, { name: string; collected: number }> = {};
  for (const g of (groups ?? []) as any[]) {
    const c = ((pay ?? []) as any[]).filter((p) => p.group_id === g.id).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const k = g.teacher_id ?? "?";
    const row = per[k] ??= { name: smap.get(g.teacher_id) ?? "—", collected: 0 };
    row.collected += c;
  }
  return NextResponse.json({
    ok: true, rate,
    rows: Object.values(per).map((r) => ({ ...r, commission: Math.round(r.collected * rate / 100) }))
      .sort((a, b) => b.commission - a.commission),
  });
}

/** PATCH /api/team/commissions {rate} — نسبة العمولة الموحدة (مالك) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const b = await req.json().catch(() => ({} as any));
  const rate = Number(b?.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
    return NextResponse.json({ ok: false, error: "bad_rate" }, { status: 400 });
  }
  const { data: t } = await admin.from("tenants").select("settings").eq("id", res.ctx.tenantId).single();
  const settings = { ...((t as any)?.settings ?? {}), commission_pct: rate };
  const { error } = await admin.from("tenants").update({ settings }).eq("id", res.ctx.tenantId);
  if (error) return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true, rate });
}
