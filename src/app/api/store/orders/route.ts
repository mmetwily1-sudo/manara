import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

/**
 * GET /api/store/orders — الطلبات (معلم). POST { order_id, action: confirm|reject }.
 * GET لطالب? لا — الطالب يرى حالته من الكتالوج (my_status).
 */
export async function GET() {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  try {
    const { data, error } = await admin.from("orders")
      .select("id,status,created_at,student_id,products(title,price)")
      .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    const sids = Array.from(new Set(((data ?? []) as any[]).map((o) => o.student_id)));
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids);
      for (const u of (us ?? []) as any[]) names[u.id] = u.full_name ?? "طالب";
    }
    return NextResponse.json({
      ok: true,
      orders: ((data ?? []) as any[]).map((o) => ({ ...o, student_name: names[o.student_id] ?? "طالب" })),
    });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 400 });
    return dbFail("store-orders", e);
  }
}

export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const body = await req.json().catch(() => ({} as any));
  if (!body.order_id || !["confirm", "reject"].includes(body.action)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const status = body.action === "confirm" ? "confirmed" : "rejected";
  const { error } = await admin.from("orders").update({ status, confirmed_by: res.ctx.userRow.id })
    .eq("id", body.order_id).eq("tenant_id", res.ctx.tenantId).eq("status", "pending");
  if (error) return dbFail("store-review", error);
  return NextResponse.json({ ok: true, status });
}
