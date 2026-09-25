import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

const BOM = "﻿";
function csv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return BOM + rows.map((r) => r.map(esc).join(",")).join("\n");
}

/**
 * GET /api/export?scope=students|payments — تصدير بيانات السنتر CSV (Excel جاهز).
 * يجعل ادعاء «بياناتك بتتصدر في أي وقت» حقيقياً.
 */
export async function GET(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const scope = new URL(req.url).searchParams.get("scope");

  if (scope === "students") {
    const { data: st } = await admin.from("users").select("full_name,phone,created_at")
      .eq("tenant_id", tid).eq("role", "student").order("created_at", { ascending: false }).limit(2000);
    const body = csv([
      ["الاسم", "الهاتف", "تاريخ التسجيل"],
      ...((st ?? []).map((s: any) => [s.full_name, s.phone ?? "", String(s.created_at ?? "").slice(0, 10)])),
    ]);
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=students.csv" },
    });
  }

  if (scope === "payments") {
    const { data: pay } = await admin.from("payments").select("amount,method,status,note,paid_at,student_id")
      .eq("tenant_id", tid).order("paid_at", { ascending: false }).limit(2000);
    const sids = Array.from(new Set((pay ?? []).map((p: any) => p.student_id).filter(Boolean)));
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: st } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
      (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
    }
    const body = csv([
      ["الطالب", "المبلغ", "الطريقة", "الحالة", "ملاحظة", "التاريخ"],
      ...((pay ?? []).map((p: any) => [names[p.student_id] ?? "", p.amount, p.method, p.status, p.note ?? "", String(p.paid_at ?? "").slice(0, 10)])),
    ]);
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=payments.csv" },
    });
  }

  return NextResponse.json({ ok: false, error: "bad_scope" }, { status: 400 });
}
