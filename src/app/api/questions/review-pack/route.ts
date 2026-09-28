import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/questions/review-pack?subject=&count= — حزمة مراجعة متوازنة الصعوبة + رفع عداد الاستخدام */
export async function GET(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") || "";
  const count = Math.min(50, Math.max(5, Number(url.searchParams.get("count") ?? 20)));
  let q = admin.from("questions").select("id,subject,lesson,difficulty,qtype,body,options,marks")
    .eq("tenant_id", tid).limit(1000);
  if (subject) q = q.eq("subject", subject);
  const { data: all, error } = await q;
  if (error) return dbFail("review-pack", error);
  const pool = ((all ?? []) as any[]).filter((x) => x.body);
  if (!pool.length) return NextResponse.json({ ok: true, pack: [], subjects: [] });
  const byDiff: Record<string, any[]> = { easy: [], mid: [], hard: [] };
  pool.forEach((x) => {
    const d = Number(x.difficulty ?? 2);
    (d <= 1 ? byDiff.easy : d >= 3 ? byDiff.hard : byDiff.mid).push(x);
  });
  const pick = (arr: any[], n: number) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  };
  const nEasy = Math.ceil(count * 0.4);
  const nMid = Math.ceil(count * 0.4);
  const pack = [...pick(byDiff.easy, nEasy), ...pick(byDiff.mid, nMid)];
  const rest = count - pack.length;
  if (rest > 0) {
    const used = new Set(pack.map((p) => p.id));
    pack.push(...pick(byDiff.hard.filter((x) => !used.has(x.id)), rest));
    if (pack.length < count) {
      const used2 = new Set(pack.map((p) => p.id));
      pack.push(...pick(pool.filter((x) => !used2.has(x.id)), count - pack.length));
    }
  }
  const ids = pack.map((p) => p.id);
  if (ids.length) {
    try {
      const { data: cur } = await admin.from("questions").select("id,usage_count").in("id", ids).limit(100);
      await Promise.all(((cur ?? []) as any[]).map((c) =>
        admin.from("questions").update({ usage_count: Number(c.usage_count ?? 0) + 1 }).eq("id", c.id)
      ));
    } catch {}
  }
  const subjects = Array.from(new Set(pool.map((x) => String(x.subject ?? "")).filter(Boolean))).sort();
  return NextResponse.json({ ok: true, subjects, pack });
}
