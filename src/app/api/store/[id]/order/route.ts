import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

/** POST /api/store/[id]/order — طلب شراء (طالب). مجاني = تأكيد فوري، مدفوع = بانتظار تأكيد المعلم. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow || (urow as any).role !== "student") {
    return NextResponse.json({ ok: false, error: "students_only" }, { status: 403 });
  }
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;
  try {
    const { data: p } = await admin.from("products").select("id,price,is_active")
      .eq("id", params.id).eq("tenant_id", tid).single();
    if (!p || !(p as any).is_active) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const { data: prev } = await admin.from("orders").select("id,status")
      .eq("product_id", params.id).eq("student_id", sid).eq("tenant_id", tid).single();
    if (prev) return NextResponse.json({ ok: true, status: (prev as any).status, duplicate: true });
    const free = Number((p as any).price ?? 0) <= 0;
    const { data, error } = await admin.from("orders").insert({
      tenant_id: tid, product_id: params.id, student_id: sid,
      status: free ? "confirmed" : "pending",
    }).select("id,status").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, status: (data as any).status });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 400 });
    return dbFail("store-order", e);
  }
}
