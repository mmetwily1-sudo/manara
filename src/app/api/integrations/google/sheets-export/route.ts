import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { getProviderToken, googleApi } from "@/lib/google";
import { arError } from "@/lib/auth-errors";

/**
 * POST /api/integrations/google/sheets-export { type: "students" | "invoices" }
 * ينشئ شيت جوجل في درايف المعلم مملوءاً بكشوف السنتر — يرجع رابط الشيت.
 */
export async function POST(req: Request) {
  const b0 = await req.json().catch(() => ({} as any));
  const type = b0?.type === "invoices" ? "invoices" : "students";
  const res = await requireTeacher(type === "invoices" ? R.billingRead : R.studentsRead);
  if ("error" in res) return res.error;
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "gsheets-export", 10)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts", message: arError("too_many_attempts") }, { status: 429 });
  }
  const token = await getProviderToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "google_reconnect", message: "اربط حساب جوجل أولاً من الإعدادات ← تكاملات جوجل" }, { status: 401 });
  }
  const b = b0;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  let title = "";
  let values: (string | number)[][] = [];
  if (type === "students") {
    title = `طلاب السنتر — ${new Date().toLocaleDateString("ar-EG")}`;
    const { data } = await admin.from("users").select("full_name,phone,created_at").eq("tenant_id", tid).eq("role", "student").order("created_at", { ascending: false }).limit(2000);
    values = [["الاسم", "الموبايل", "تاريخ التسجيل"], ...((data ?? []) as any[]).map((u) => [u.full_name ?? "", u.phone ?? "", u.created_at ? String(u.created_at).slice(0, 10) : ""])];
  } else {
    title = `فواتير السنتر — ${new Date().toLocaleDateString("ar-EG")}`;
    const { data } = await admin.from("invoices").select("amount,paid_amount,status,due_date,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(2000);
    values = [["المبلغ", "المدفوع", "الحالة", "الاستحقاق"], ...((data ?? []) as any[]).map((v) => [v.amount ?? 0, v.paid_amount ?? 0, v.status ?? "", v.due_date ?? ""])];
  }

  const sheet = await googleApi(token, "/sheets/v4/spreadsheets", {
    method: "POST",
    body: { properties: { title }, sheets: [{ properties: { title: "الكشف", rightToLeft: true } }] },
  });
  if (sheet.unauth) {
    return NextResponse.json({ ok: false, error: "google_reconnect", message: "انتهت صلاحية الربط — أعد الربط من الإعدادات" }, { status: 401 });
  }
  if (!sheet.ok || !sheet.data?.spreadsheetId) {
    return NextResponse.json({ ok: false, error: "sheets_failed", message: "تعذر إنشاء الشيت — حاول تاني" }, { status: 500 });
  }
  const id = sheet.data.spreadsheetId as string;
  await googleApi(token, `/sheets/v4/spreadsheets/${id}/values/الكشف!A1:Z5000?valueInputOption=RAW`, {
    method: "PUT",
    body: { values },
  });
  return NextResponse.json({ ok: true, url: sheet.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${id}` });
}
