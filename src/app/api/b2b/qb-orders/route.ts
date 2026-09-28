import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

const STATUS_LABEL: Record<string, string> = { pending: "معلق", active: "مفعل", expired: "منتهي" };

/** GET /api/b2b/qb-orders — طلبات بنك الأسئلة (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data, error } = await res.ctx.admin.from("qb_orders")
    .select("id,school_name,contact,subject,price,status,access_until,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
  if (error) return dbFail("qb-list", error);
  return NextResponse.json({
    ok: true,
    rows: ((data ?? []) as any[]).map((r) => ({ ...r, status_label: STATUS_LABEL[r.status] ?? r.status })),
  });
}

/** POST /api/b2b/qb-orders {school_name, contact?, subject?, price?} — طلب جديد (مالك) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!String(b?.school_name ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("qb_orders").insert({
    tenant_id: res.ctx.tenantId, school_name: String(b.school_name).slice(0, 150),
    contact: String(b?.contact ?? "").slice(0, 100), subject: String(b?.subject ?? "").slice(0, 80),
    price: Math.max(0, Number(b?.price ?? 0)),
  });
  if (error) return dbFail("qb-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/b2b/qb-orders {id, status, access_until?} — تفعيل/إنهاء (مالك) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id || !["pending", "active", "expired"].includes(b?.status)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const patch: any = { status: b.status };
  if (b?.access_until) patch.access_until = b.access_until;
  if (b.status === "active" && !b?.access_until) {
    patch.access_until = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  }
  const { error } = await res.ctx.admin.from("qb_orders").update(patch)
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("qb-update", error);
  return NextResponse.json({ ok: true });
}
