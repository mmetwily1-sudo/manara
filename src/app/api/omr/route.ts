import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * GET /api/omr — أوراق البابل شيت (معلم).
 * POST /api/omr { title, num_questions, num_choices?, answer_key[] } — إنشاء ورقة بنموذج إجابة.
 */
export async function GET() {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  try {
    const { data: sheets, error } = await admin
      .from("omr_sheets").select("id,title,num_questions,num_choices,created_at")
      .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ids = ((sheets ?? []) as any[]).map((s) => s.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: rs } = await admin.from("omr_results").select("sheet_id").in("sheet_id", ids);
      for (const r of (rs ?? []) as any[]) counts[r.sheet_id] = (counts[r.sheet_id] ?? 0) + 1;
    }
    return NextResponse.json({
      ok: true,
      sheets: ((sheets ?? []) as any[]).map((s) => ({ ...s, results: counts[s.id] ?? 0 })),
    });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json({ ok: false, error: "not_ready", message: "نفّذ ترحيل 006 من لوحة Supabase أولاً." }, { status: 400 });
    }
    return dbFail("omr-list", e);
  }
}

export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { isRateLimited } = await import("@/lib/rate-limit");
  if (await isRateLimited(req, "omr-create", 20, 60 * 60 * 1000, tid)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({} as any));
  const title = String(body.title ?? "").trim().slice(0, 200);
  const nq = Math.floor(Number(body.num_questions ?? 0));
  const nc = Math.floor(Number(body.num_choices ?? 4));
  const key = Array.isArray(body.answer_key) ? body.answer_key.map((x: any) => String(x ?? "").trim().toUpperCase()) : [];
  if (title.length < 2 || !(nq >= 1 && nq <= 200) || !(nc >= 2 && nc <= 6)) {
    return NextResponse.json({ ok: false, error: "bad_request", message: "العنوان وعدد الأسئلة (1–200) والاختيارات (2–6) مطلوبة." }, { status: 400 });
  }
  if (key.length !== nq || !key.every((k: string) => LETTERS.slice(0, nc).includes(k))) {
    return NextResponse.json({ ok: false, error: "bad_key", message: "نموذج الإجابة يجب أن يغطي كل الأسئلة (A.. حسب الاختيارات)." }, { status: 400 });
  }
  try {
    const { data, error } = await admin.from("omr_sheets").insert({
      tenant_id: tid, title, num_questions: nq, num_choices: nc, answer_key: key,
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any).id });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json({ ok: false, error: "not_ready", message: "نفّذ ترحيل 006 من لوحة Supabase أولاً." }, { status: 400 });
    }
    return dbFail("omr-create", e);
  }
}
