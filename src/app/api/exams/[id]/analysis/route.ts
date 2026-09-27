import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

const norm = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

/** GET /api/exams/[id]/analysis — تحليل مفردات: نسبة الصواب لكل سؤال + أصعبها + راسبون */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;

  const { data: ex } = await sb.from("exams").select("id,title").eq("id", params.id).eq("tenant_id", tid).single();
  if (!ex) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const [{ data: links }, { data: atts }] = await Promise.all([
    sb.from("exam_questions").select("question_id,marks,questions(body,correct_answer,qtype)")
      .eq("exam_id", params.id).eq("tenant_id", tid).limit(200),
    sb.from("exam_attempts").select("student_id,score,answers").eq("exam_id", params.id).eq("tenant_id", tid).limit(2000),
  ]);
  const total = ((links ?? []) as any[]).reduce((s, l) => s + Number(l.marks ?? 0), 0);
  const items = ((links ?? []) as any[]).map((l) => {
    let tried = 0, right = 0;
    for (const a of (atts ?? []) as any[]) {
      const ans = (a.answers as any)?.[l.question_id];
      if (ans == null || ans === "") continue;
      tried++;
      if (norm(ans) === norm((l.questions as any)?.correct_answer)) right++;
    }
    return {
      body: String((l.questions as any)?.body ?? "").slice(0, 80),
      tried, rate: tried ? Math.round((right / tried) * 100) : null,
    };
  }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  const sids = Array.from(new Set(((atts ?? []) as any[]).map((a) => a.student_id).filter(Boolean))) as string[];
  let people: Record<string, { name: string; phone: string | null }> = {};
  if (sids.length) {
    const { data: st } = await sb.from("users").select("id,full_name,phone").in("id", sids);
    (st ?? []).forEach((s: any) => { people[s.id] = { name: s.full_name, phone: s.phone ?? null }; });
  }
  const failed = ((atts ?? []) as any[])
    .filter((a) => total > 0 && (Number(a.score ?? 0) / total) * 100 < 50)
    .map((a) => ({ student_id: a.student_id, name: people[a.student_id]?.name ?? "—", phone: people[a.student_id]?.phone ?? null, score: a.score, total }));

  return NextResponse.json({
    ok: true, title: (ex as any).title, attempts: (atts ?? []).length, total,
    hardest: items.slice(0, 5), items: items.slice(0, 50), failed,
  });
}
