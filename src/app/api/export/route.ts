import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

const BOM = "﻿";
function csv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return BOM + rows.map((r) => r.map(esc).join(",")).join("\n");
}

/**
 * GET /api/export?scope=students|payments|invoices|grades[&exam_id=] — تصدير بيانات السنتر CSV (Excel جاهز).
 * يجعل ادعاء «بياناتك بتتصدر في أي وقت» حقيقياً.
 */
export async function GET(req: Request) {
  const res = await requireTeacher(R.billingRead);
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

  if (scope === "invoices") {
    const { data: inv } = await admin.from("invoices").select("period,amount,paid,status,receipt_no,student_id")
      .eq("tenant_id", tid).order("period", { ascending: false }).limit(2000);
    const sids = Array.from(new Set((inv ?? []).map((x: any) => x.student_id).filter(Boolean)));
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: st } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
      (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
    }
    const body = csv([
      ["الطالب", "الفترة", "المبلغ", "المدفوع", "المتبقي", "الحالة", "إيصال"],
      ...((inv ?? []).map((x: any) => [names[x.student_id] ?? "", x.period, x.amount, x.paid ?? 0, Number(x.amount ?? 0) - Number(x.paid ?? 0), x.status, x.receipt_no ?? ""])),
    ]);
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=invoices.csv" },
    });
  }

  if (scope === "grades") {
    const examId = new URL(req.url).searchParams.get("exam_id");
    let q = admin.from("exam_attempts").select("exam_id,student_id,score,submitted_at").eq("tenant_id", tid).order("submitted_at", { ascending: false }).limit(2000);
    if (examId) q = q.eq("exam_id", examId);
    const { data: atts } = await q;
    const sids = Array.from(new Set((atts ?? []).map((a: any) => a.student_id).filter(Boolean)));
    const eids = Array.from(new Set((atts ?? []).map((a: any) => a.exam_id).filter(Boolean)));
    let names: Record<string, string> = {};
    let exams: Record<string, string> = {};
    if (sids.length) {
      const { data: st } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
      (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
    }
    if (eids.length) {
      const { data: ex } = await admin.from("exams").select("id,title").in("id", eids as string[]);
      (ex ?? []).forEach((e: any) => { exams[e.id] = e.title; });
    }
    const body = csv([
      ["الامتحان", "الطالب", "الدرجة", "التاريخ"],
      ...((atts ?? []).map((a: any) => [exams[a.exam_id] ?? "", names[a.student_id] ?? "", a.score ?? 0, String(a.submitted_at ?? "").slice(0, 10)])),
    ]);
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=grades.csv" },
    });
  }

  if (scope === "answerkey") {
    const examId = new URL(req.url).searchParams.get("exam_id");
    if (!examId) return NextResponse.json({ ok: false, error: "exam_required" }, { status: 400 });
    const { data: links } = await admin.from("exam_questions").select("position,marks,questions(body,correct_answer)")
      .eq("tenant_id", tid).eq("exam_id", examId).order("position", { ascending: true }).limit(200);
    const body = csv([
      ["م", "السؤال", "الدرجة", "الإجابة النموذجية"],
      ...((links ?? []).map((l: any, i: number) => [i + 1, String(l.questions?.body ?? "").slice(0, 200), l.marks ?? 0, l.questions?.correct_answer ?? ""])),
    ]);
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=answerkey.csv" },
    });
  }

  return NextResponse.json({ ok: false, error: "bad_scope" }, { status: 400 });
}
