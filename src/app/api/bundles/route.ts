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

/** GET /api/bundles — طالب: النشطة + اشتراكاتي | معلم: الكل + عدد المشتركين */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  let q = admin.from("bundles").select("id,title,subjects,price,active")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100);
  if (!isTeacher) q = q.eq("active", true);
  const { data: bundles, error } = await q;
  if (error) return dbFail("bundles-list", error);
  const out: any = { ok: true, isTeacher, bundles: bundles ?? [] };
  if (isTeacher) {
    const bids = ((bundles ?? []) as any[]).map((b) => b.id);
    let counts: Record<string, number> = {};
    if (bids.length) {
      const { data: subs } = await admin.from("bundle_subs").select("bundle_id")
        .eq("tenant_id", tid).in("bundle_id", bids).eq("period", curPeriod()).limit(2000);
      ((subs ?? []) as any[]).forEach((s) => { counts[s.bundle_id] = (counts[s.bundle_id] ?? 0) + 1; });
    }
    out.subsThisMonth = counts;
  } else {
    const { data: mine } = await admin.from("bundle_subs").select("bundle_id,period")
      .eq("tenant_id", tid).eq("student_id", urow.id).eq("period", curPeriod()).limit(50);
    out.mine = ((mine ?? []) as any[]).map((s) => s.bundle_id);
  }
  return NextResponse.json(out);
}

/** POST /api/bundles — معلم: باقة جديدة | طالب: اشتراك {bundle_id} يولد فاتورة */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  if (isTeacher) { const _sw = await (await import("@/lib/server-auth")).enforceRenewalWrite(admin, tid, urow.role); if (_sw) return _sw; }
  const b = await req.json().catch(() => ({} as any));
  if (isTeacher) {
    const price = Number(b?.price ?? NaN);
    if (!String(b?.title ?? "").trim() || !(price >= 0)) {
      return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
    }
    const { error } = await admin.from("bundles").insert({
      tenant_id: tid, title: String(b.title).slice(0, 120),
      subjects: String(b?.subjects ?? "").slice(0, 300), price,
    });
    if (error) return dbFail("bundle-create", error);
    return NextResponse.json({ ok: true });
  }
  const period = curPeriod();
  const { featureOn } = await import("@/lib/features");
  if (!(await featureOn(admin, tid, "bundles"))) {
    return NextResponse.json({ ok: false, error: "feature_disabled" }, { status: 403 });
  }
  const { data: bun } = await admin.from("bundles").select("id,price,active")
    .eq("id", b?.bundle_id).eq("tenant_id", tid).single();
  if (!bun || !(bun as any).active) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { data: dup } = await admin.from("bundle_subs").select("id")
    .eq("tenant_id", tid).eq("bundle_id", (bun as any).id).eq("student_id", urow.id).eq("period", period).single();
  if (dup) return NextResponse.json({ ok: false, error: "already" }, { status: 400 });
  const { data: inv, error: ie } = await admin.from("invoices").insert({
    tenant_id: tid, student_id: urow.id, period, amount: Number((bun as any).price ?? 0),
  }).select("id").single();
  if (ie || !inv) return dbFail("bundle-invoice", ie);
  const { error: se } = await admin.from("bundle_subs").insert({
    tenant_id: tid, bundle_id: (bun as any).id, student_id: urow.id, period, invoice_id: (inv as any).id,
  });
  if (se) return dbFail("bundle-sub", se);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/bundles {id, active} — تفعيل/إيقاف (معلم) */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await m.admin.from("bundles").update({ active: !!b.active })
    .eq("id", b.id).eq("tenant_id", m.urow.tenant_id);
  if (error) return dbFail("bundle-toggle", error);
  return NextResponse.json({ ok: true });
}
