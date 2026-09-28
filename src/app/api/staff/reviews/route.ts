import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/staff/reviews?month=YYYY-MM — تقييمات الشهر + المتوسط (مالك فقط) */
export async function GET(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const { data: reviews, error } = await admin.from("teacher_reviews")
    .select("user_id,month,score,note").eq("tenant_id", tid).eq("month", month).limit(500);
  if (error) return dbFail("reviews-list", error);
  const uids = Array.from(new Set(((reviews ?? []) as any[]).map((r) => r.user_id)));
  let names: Record<string, string> = {};
  if (uids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", uids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  const rows = ((reviews ?? []) as any[]).map((r) => ({ ...r, name: names[r.user_id] ?? "" }));
  const avg = rows.length ? rows.reduce((s, r) => s + Number(r.score ?? 0), 0) / rows.length : 0;
  return NextResponse.json({ ok: true, month, avg: Math.round(avg * 10) / 10, reviews: rows });
}

/** POST /api/staff/reviews {user_id, month, score 1-5, note?} — تقييم/تحديث (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const userId = String(b?.user_id ?? "");
  const month = String(b?.month ?? "");
  const score = Number(b?.score ?? NaN);
  if (!userId || !/^\d{4}-\d{2}$/.test(month) || !(score >= 1 && score <= 5)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: target } = await admin.from("users").select("id").eq("id", userId).eq("tenant_id", tid).single();
  if (!target) return NextResponse.json({ ok: false, error: "bad_user" }, { status: 400 });
  const { error } = await admin.from("teacher_reviews").upsert(
    { tenant_id: tid, user_id: userId, month, score, note: String(b?.note ?? "").slice(0, 500) },
    { onConflict: "tenant_id,user_id,month" }
  );
  if (error) return dbFail("review-save", error);
  return NextResponse.json({ ok: true });
}
