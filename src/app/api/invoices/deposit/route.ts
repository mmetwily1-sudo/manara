import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** POST /api/invoices/deposit {student_id, amount, note?} — فاتورة عربون حجز مقعد (تُخصم من أول تحصيل FIFO) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite, { req: req });
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const amount = Math.round(Number(b?.amount) || 0);
  if (!b?.student_id || amount <= 0) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const { data: st } = await sb.from("users").select("id").eq("id", b.student_id).eq("tenant_id", tid).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const period = new Date().toISOString().slice(0, 7);
  const { data, error } = await sb.from("invoices").insert({
    tenant_id: tid, student_id: (st as any).id, group_id: null, period, amount,
    note: `عربون حجز مقعد 🪑 ${String(b?.note ?? "").trim().slice(0, 200)}`.trim(),
  }).select("id").single();
  if (error || !data) return dbFail("deposit", error);
  return NextResponse.json({ ok: true, id: (data as any).id, period, amount });
}
