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

/** GET /api/events — طالب: القادمة النشطة + تسجيلاتي | معلم: الكل + أعداد المسجلين */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  let q = admin.from("events").select("id,title,event_at,fee,capacity,active")
    .eq("tenant_id", tid).gte("event_at", new Date().toISOString())
    .order("event_at", { ascending: true }).limit(50);
  if (!isTeacher) q = q.eq("active", true);
  const { data: events, error } = await q;
  if (error) return dbFail("events-list", error);
  const out: any = { ok: true, isTeacher, events: events ?? [] };
  const eids = ((events ?? []) as any[]).map((e) => e.id);
  if (eids.length) {
    if (isTeacher) {
      const { data: regs } = await admin.from("event_regs").select("event_id")
        .eq("tenant_id", tid).in("event_id", eids).limit(5000);
      const counts: Record<string, number> = {};
      ((regs ?? []) as any[]).forEach((r) => { counts[r.event_id] = (counts[r.event_id] ?? 0) + 1; });
      out.counts = counts;
    } else {
      const { data: mine } = await admin.from("event_regs").select("event_id")
        .eq("tenant_id", tid).eq("student_id", urow.id).in("event_id", eids).limit(100);
      out.mine = ((mine ?? []) as any[]).map((r) => r.event_id);
    }
  } else { out.counts = {}; out.mine = []; }
  return NextResponse.json(out);
}

/** POST /api/events — معلم: فعالية جديدة | طالب: تسجيل {event_id} (+ فاتورة إن برسوم) */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  if (isTeacher) { const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(admin, tid, urow.role); if (_sw) return _sw; }
  const b = await req.json().catch(() => ({} as any));
  if (isTeacher) {
    if (!String(b?.title ?? "").trim() || !b?.event_at) {
      return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
    }
    const { error } = await admin.from("events").insert({
      tenant_id: tid, title: String(b.title).slice(0, 150), event_at: new Date(b.event_at).toISOString(),
      fee: Math.max(0, Number(b?.fee ?? 0)), capacity: b?.capacity === "" ? -1 : Number(b?.capacity ?? -1),
    });
    if (error) return dbFail("event-create", error);
    return NextResponse.json({ ok: true });
  }
  const { data: ev } = await admin.from("events").select("id,fee,capacity,active")
    .eq("id", b?.event_id).eq("tenant_id", tid).single();
  if (!ev || !(ev as any).active) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!isTeacher) {
    const { featureOn } = await import("@/lib/features");
    if (!(await featureOn(admin, tid, "events"))) {
      return NextResponse.json({ ok: false, error: "feature_disabled" }, { status: 403 });
    }
  }
  const { data: dup } = await admin.from("event_regs").select("id")
    .eq("tenant_id", tid).eq("event_id", (ev as any).id).eq("student_id", urow.id).single();
  if (dup) return NextResponse.json({ ok: false, error: "already" }, { status: 400 });
  if (Number((ev as any).capacity ?? -1) >= 0) {
    const { count } = await admin.from("event_regs").select("id", { count: "exact", head: true })
      .eq("tenant_id", tid).eq("event_id", (ev as any).id);
    if ((count ?? 0) >= Number((ev as any).capacity)) {
      return NextResponse.json({ ok: false, error: "full" }, { status: 400 });
    }
  }
  let invoiceId: string | null = null;
  const fee = Number((ev as any).fee ?? 0);
  if (fee > 0) {
    const { data: inv, error: ie } = await admin.from("invoices").insert({
      tenant_id: tid, student_id: urow.id, period: curPeriod(), amount: fee,
    }).select("id").single();
    if (ie || !inv) return dbFail("event-invoice", ie);
    invoiceId = (inv as any).id;
  }
  const { error: re } = await admin.from("event_regs").insert({
    tenant_id: tid, event_id: (ev as any).id, student_id: urow.id, invoice_id: invoiceId,
  });
  if (re) return dbFail("event-reg", re);
  return NextResponse.json({ ok: true, invoiced: fee > 0 });
}

/** PATCH /api/events {id, active} — تفعيل/إيقاف (معلم) */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await m.admin.from("events").update({ active: !!b.active })
    .eq("id", b.id).eq("tenant_id", m.urow.tenant_id);
  if (error) return dbFail("event-toggle", error);
  return NextResponse.json({ ok: true });
}
