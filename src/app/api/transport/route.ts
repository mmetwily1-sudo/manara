import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

function curPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role")
    .eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/transport — العربيات والخطوط (طالب: النشطة + اشتراكاتي | معلم: الكل + الأعداد) */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  let vq = admin.from("vehicles").select("id,plate,capacity,driver,active").eq("tenant_id", tid).limit(100);
  let rq = admin.from("transport_routes").select("id,name,stops,fee,vehicle_id,active").eq("tenant_id", tid).limit(100);
  if (!isTeacher) { vq = vq.eq("active", true); rq = rq.eq("active", true); }
  const [{ data: vehicles }, { data: routes }] = await Promise.all([vq, rq]);
  const out: any = { ok: true, isTeacher, vehicles: vehicles ?? [], routes: routes ?? [] };
  const rids = ((routes ?? []) as any[]).map((r) => r.id);
  if (rids.length) {
    if (isTeacher) {
      const { data: subs } = await admin.from("route_subs").select("route_id")
        .eq("tenant_id", tid).in("route_id", rids).eq("period", curPeriod()).limit(5000);
      const counts: Record<string, number> = {};
      ((subs ?? []) as any[]).forEach((s) => { counts[s.route_id] = (counts[s.route_id] ?? 0) + 1; });
      out.counts = counts;
    } else {
      const { data: mine } = await admin.from("route_subs").select("route_id")
        .eq("tenant_id", tid).eq("student_id", urow.id).in("route_id", rids).eq("period", curPeriod()).limit(100);
      out.mine = ((mine ?? []) as any[]).map((s) => s.route_id);
    }
  } else { out.counts = {}; out.mine = []; }
  return NextResponse.json(out);
}

/** POST /api/transport — معلم: {action: vehicle|route} | طالب: {action: subscribe, route_id} */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  if (isTeacher) { const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(admin, tid, urow.role); if (_sw) return _sw; }
  const b = await req.json().catch(() => ({} as any));
  if (isTeacher && b?.action === "vehicle") {
    const { error } = await admin.from("vehicles").insert({
      tenant_id: tid, plate: String(b?.plate ?? "").slice(0, 20),
      capacity: Math.max(0, Number(b?.capacity ?? 0)), driver: String(b?.driver ?? "").slice(0, 80),
    });
    if (error) return dbFail("vehicle-create", error);
    return NextResponse.json({ ok: true });
  }
  if (isTeacher && b?.action === "route") {
    if (!String(b?.name ?? "").trim()) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
    const { error } = await admin.from("transport_routes").insert({
      tenant_id: tid, name: String(b.name).slice(0, 120), stops: String(b?.stops ?? "").slice(0, 500),
      fee: Math.max(0, Number(b?.fee ?? 0)), vehicle_id: b?.vehicle_id || null,
    });
    if (error) return dbFail("route-create", error);
    return NextResponse.json({ ok: true });
  }
  if (!isTeacher && b?.action === "subscribe") {
    const { featureOn } = await import("@/lib/features");
    if (!(await featureOn(admin, tid, "transport"))) {
      return NextResponse.json({ ok: false, error: "feature_disabled" }, { status: 403 });
    }
    const period = curPeriod();
    const { data: rt } = await admin.from("transport_routes").select("id,fee,active")
      .eq("id", b?.route_id).eq("tenant_id", tid).single();
    if (!rt || !(rt as any).active) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const { data: dup } = await admin.from("route_subs").select("id")
      .eq("tenant_id", tid).eq("route_id", (rt as any).id).eq("student_id", urow.id).eq("period", period).single();
    if (dup) return NextResponse.json({ ok: false, error: "already" }, { status: 400 });
    let invoiceId: string | null = null;
    const fee = Number((rt as any).fee ?? 0);
    if (fee > 0) {
      const { data: inv, error: ie } = await admin.from("invoices").insert({
        tenant_id: tid, student_id: urow.id, period, amount: fee,
      }).select("id").single();
      if (ie || !inv) return dbFail("route-invoice", ie);
      invoiceId = (inv as any).id;
    }
    const { error: se } = await admin.from("route_subs").insert({
      tenant_id: tid, route_id: (rt as any).id, student_id: urow.id, period, invoice_id: invoiceId,
    });
    if (se) return dbFail("route-sub", se);
    return NextResponse.json({ ok: true, invoiced: fee > 0 });
  }
  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
