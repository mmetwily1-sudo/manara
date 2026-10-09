import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

const CATS: Record<string, string> = { rent: "إيجار 🏠", salaries: "مرتبات 💼", utilities: "مرافق 💡", supplies: "مستلزمات 📦", marketing: "تسويق 📣", maintenance: "صيانة 🛠️", general: "عام 📋" };

/** GET /api/expenses — المصروفات + إجمالي الشهر (مالك + محاسب) */
export async function GET() {
  const res = await requireTeacher(R.billingRead);
  if ("error" in res) return res.error;
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await res.ctx.admin.from("expenses")
    .select("id,title,amount,category,spent_at,note,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("spent_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as any[];
  const monthTotal = rows.filter((x) => String(x.spent_at ?? "").startsWith(month)).reduce((s, x) => s + Number(x.amount ?? 0), 0);
  return NextResponse.json({ ok: true, expenses: rows, monthTotal, month, cats: CATS });
}

/** POST /api/expenses {title, amount, category?, spent_at?, note?} — مصروف جديد (مالك + محاسب) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.billingWrite, { req: req });
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  const title = String(b?.title ?? "").trim().slice(0, 150);
  const amount = Math.round(Number(b?.amount) || 0);
  if (!title || amount <= 0) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  const { data, error } = await res.ctx.admin.from("expenses").insert({
    tenant_id: res.ctx.tenantId, title, amount,
    category: CATS[b?.category] ? b.category : "general",
    spent_at: /^\d{4}-\d{2}-\d{2}$/.test(String(b?.spent_at ?? "")) ? b.spent_at : new Date().toISOString().slice(0, 10),
    note: String(b?.note ?? "").trim().slice(0, 300),
    created_by: res.ctx.userRow.id,
  }).select("id").single();
  if (error || !data) return dbFail("expense-create", error);
  return NextResponse.json({ ok: true, id: (data as any).id });
}
