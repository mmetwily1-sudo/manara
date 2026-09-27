import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/staff/names — أسماء الطاقم للاختيار (محتوى+) بلا بيانات حساسة */
export async function GET() {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("users").select("id,full_name")
    .eq("tenant_id", res.ctx.tenantId).in("role", ["teacher_admin", "supervisor", "assistant"]).limit(100);
  return NextResponse.json({ ok: true, staff: data ?? [] });
}
