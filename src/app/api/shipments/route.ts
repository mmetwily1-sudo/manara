import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

function curPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = { pending: "قيد التجهيز", shipped: "مشحونة 🚚", delivered: "تم الاستلام" };

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role")
    .eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/shipments — طالب: طلباتي | معلم: الكل + الأسماء */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const isTeacher = urow.role !== "student";
  let q = admin.from("shipments").select("id,student_id,governorate,address,items,fee,status,created_at")
    .eq("tenant_id", urow.tenant_id).order("created_at", { ascending: false }).limit(200);
  if (!isTeacher) q = q.eq("student_id", urow.id);
  const { data: rows, error } = await q;
  if (error) return dbFail("shipments-list", error);
  let names: Record<string, string> = {};
  if (isTeacher) {
    const sids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.student_id)));
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
  }
  return NextResponse.json({
    ok: true, isTeacher,
    rows: ((rows ?? []) as any[]).map((r) => ({
      ...r, status_label: STATUS_LABEL[r.status] ?? r.status, student: names[r.student_id] ?? "",
    })),
  });
}

/** POST /api/shipments {governorate, address, items} — طالب: طلب شحن */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role !== "student") return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!String(b?.governorate ?? "").trim() || !String(b?.address ?? "").trim() || !String(b?.items ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { error } = await m.admin.from("shipments").insert({
    tenant_id: m.urow.tenant_id, student_id: m.urow.id,
    governorate: String(b.governorate).slice(0, 60), address: String(b.address).slice(0, 300),
    items: String(b.items).slice(0, 500),
  });
  if (error) return dbFail("shipment-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/shipments {id, action: ship|deliver, fee?} — معلم: شحن (+فاتورة رسوم) / تسليم */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { admin, urow } = m;
  const b = await req.json().catch(() => ({} as any));
  const { data: sh } = await admin.from("shipments").select("id,status,student_id")
    .eq("id", b?.id).eq("tenant_id", urow.tenant_id).single();
  if (!sh) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (b?.action === "ship" && (sh as any).status === "pending") {
    const fee = Math.max(0, Number(b?.fee ?? 0));
    let invoiceId: string | null = null;
    if (fee > 0) {
      const { data: inv, error: ie } = await admin.from("invoices").insert({
        tenant_id: urow.tenant_id, student_id: (sh as any).student_id, period: curPeriod(), amount: fee,
      }).select("id").single();
      if (ie || !inv) return dbFail("shipment-invoice", ie);
      invoiceId = (inv as any).id;
    }
    const { error } = await admin.from("shipments").update({ status: "shipped", fee, invoice_id: invoiceId })
      .eq("id", b.id).eq("tenant_id", urow.tenant_id);
    if (error) return dbFail("shipment-ship", error);
    return NextResponse.json({ ok: true, invoiced: fee > 0 });
  }
  if (b?.action === "deliver" && (sh as any).status === "shipped") {
    const { error } = await admin.from("shipments").update({ status: "delivered" })
      .eq("id", b.id).eq("tenant_id", urow.tenant_id);
    if (error) return dbFail("shipment-deliver", error);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}
