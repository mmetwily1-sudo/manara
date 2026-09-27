import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/questions/quality — تقييم جودة بنك الأسئلة: ناقص/بلا استخدام/توزيع صعوبة */
export async function GET() {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("questions")
    .select("id,qtype,body,options,marks,usage_count,status,difficulty")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(500);
  const rows = (data ?? []) as any[];
  const issues: { id: string; body: string; problem: string }[] = [];
  const byDiff: Record<string, number> = {};
  let unused = 0;
  for (const q of rows) {
    byDiff[String(q.difficulty ?? "?")] = (byDiff[String(q.difficulty ?? "?")] ?? 0) + 1;
    if (Number(q.usage_count ?? 0) === 0) unused++;
    const probs: string[] = [];
    if (String(q.body ?? "").trim().length < 10) probs.push("نص ناقص");
    if (q.qtype === "mcq") {
      const opts = Array.isArray(q.options) ? q.options : [];
      if (opts.length < 2) probs.push("اختيارات ناقصة (<2)");
    }
    if (q.marks == null || Number(q.marks) <= 0) probs.push("بلا درجة");
    if (q.status === "draft") probs.push("مسودة غير معتمدة");
    if (probs.length && issues.length < 50) issues.push({ id: q.id, body: String(q.body ?? "").slice(0, 80), problem: probs.join(" + ") });
  }
  const ranked = [...rows].sort((a, b) => Number(b.usage_count ?? 0) - Number(a.usage_count ?? 0));
  const top = ranked.slice(0, 3).map((q) => ({ body: String(q.body ?? "").slice(0, 60), used: Number(q.usage_count ?? 0) }));
  return NextResponse.json({ ok: true, total: rows.length, unused, broken: issues.length, issues, byDifficulty: byDiff, top });
}
