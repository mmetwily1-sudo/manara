import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** mulberry32 خلط حتمي بالبذرة */
function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  const rnd = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * POST /api/exams/[id]/variants {count?: 2|3} — نماذج متوازية A/B/C:
 * نفس الأسئلة موزعة بالتناوب على مسودات (توزيع عادل للصعوبة قدر الإمكان).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content, { req: req });
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const count = [2, 3].includes(Number(b?.count)) ? Number(b.count) : 2;

  const { data: src } = await sb.from("exams")
    .select("id,title,duration_minutes,total_marks,require_code")
    .eq("id", params.id).eq("tenant_id", tid).single();
  if (!src) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { data: links } = await sb.from("exam_questions")
    .select("question_id,position,marks,questions(difficulty)")
    .eq("exam_id", params.id).eq("tenant_id", tid).limit(200);
  if (!((links ?? []).length >= count)) {
    return NextResponse.json({ ok: false, error: "too_few_questions" }, { status: 400 });
  }
  // ترتيب بالصعوبة ثم توزيع دائري + خلط داخل كل نموذج
  const sorted = [...(links as any[])].sort((a, b) => Number(a.questions?.difficulty ?? 3) - Number(b.questions?.difficulty ?? 3));
  const buckets: any[][] = Array.from({ length: count }, () => []);
  sorted.forEach((l, i) => buckets[i % count].push(l));
  const letters = ["A", "B", "C"];
  const made: string[] = [];
  for (let i = 0; i < count; i++) {
    const order = shuffled(buckets[i], Date.now() % 100000 + i);
    const { data: neo } = await sb.from("exams").insert({
      tenant_id: tid, title: `${(src as any).title} — نموذج ${letters[i]}`.slice(0, 120),
      duration_minutes: (src as any).duration_minutes ?? 30,
      total_marks: (src as any).total_marks ?? null, is_published: false,
      require_code: !!(src as any).require_code,
    }).select("id").single();
    if (!neo) continue;
    await sb.from("exam_questions").insert(order.map((l: any, p: number) => ({
      tenant_id: tid, exam_id: (neo as any).id, question_id: l.question_id, position: p + 1, marks: l.marks,
    })));
    made.push((neo as any).id);
  }
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "exam:variants", entity_type: "exam", entity_id: params.id, details: { count, made },
    });
  } catch {}
  return NextResponse.json({ ok: true, ids: made, count: made.length });
}
