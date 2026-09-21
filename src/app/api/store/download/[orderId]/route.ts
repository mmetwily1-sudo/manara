import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/store/download/[orderId] — رابط تحميل موقع لمنتج مؤكد (طالب المالك فقط). */
export async function GET(_req: Request, { params }: { params: { orderId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  try {
    const { data: o } = await admin.from("orders").select("id,student_id,products(file_path)")
      .eq("id", params.orderId).eq("tenant_id", (urow as any).tenant_id).single();
    if (!o || (o as any).student_id !== (urow as any).id) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    // يجب أن يكون مؤكداً
    const { data: st } = await admin.from("orders").select("status").eq("id", params.orderId).single();
    if ((st as any)?.status !== "confirmed") {
      return NextResponse.json({ ok: false, error: "not_confirmed", message: "طلبك بانتظار تأكيد المعلم." }, { status: 400 });
    }
    const fp = (o as any).products?.file_path;
    if (!fp) return NextResponse.json({ ok: false, error: "no_file" }, { status: 404 });
    const { data, error } = await admin.storage.from("store").createSignedUrl(fp, 600);
    if (error || !data?.signedUrl) return dbFail("store-download", error, "sign_failed");
    return NextResponse.json({ ok: true, url: data.signedUrl });
  } catch (e: any) {
    return dbFail("store-download", e);
  }
}
