import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

/**
 * GET /api/exams/[id]/suspicion — مؤشرات اشتباه إحصائية (لا اتهام!).
 * wrong_overlap ≥70% مع ≥5 أخطاء مشتركة (+25) · زمن ضمن الأسرع + درجة عالية (+35) ·
 * تبديل تبويب مرتفع (+20) · تطابق إجابات كلي ≥90% (+20). العتبات: ≥70 مرتفع، 40-69 مراجعة.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  try {
    const { data: exam } = await admin.from("exams").select("id,title,duration_minutes")
      .eq("id", params.id).eq("tenant_id", tid).single();
    if (!exam) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const { data: eqs } = await admin.from("exam_questions")
      .select("question_id,questions(correct_answer)")
      .eq("exam_id", params.id).eq("tenant_id", tid).limit(200);
    const correct: Record<string, string> = {};
    (eqs ?? []).forEach((r: any) => { correct[r.question_id] = String(r.questions?.correct_answer ?? "").trim().toLowerCase(); });

    const { data: atts } = await admin.from("exam_attempts")
      .select("student_id,answers,score,started_at,submitted_at,tab_switches")
      .eq("exam_id", params.id).eq("tenant_id", tid).limit(500);
    const rows = (atts ?? []).filter((a: any) => a.answers && typeof a.answers === "object");
    if (rows.length < 2) return NextResponse.json({ ok: true, flags: [], note: "need_2_attempts" });

    const norm = (v: any) => String(v ?? "").trim().toLowerCase();
    const info: { sid: string; ans: Record<string, string>; qids: string[]; wrong: Set<string>; durMin: number | null; score: number; tabs: number }[] = rows.map((a: any) => {
      const ans: Record<string, string> = a.answers ?? {};
      const qids: string[] = Object.keys(ans);
      const wrong: Set<string> = new Set(qids.filter((q: string) => correct[q] !== undefined && norm(ans[q]) !== correct[q]));
      const durMin = a.started_at && a.submitted_at
        ? Math.max(0, (new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000) : null;
      return { sid: a.student_id, ans, qids, wrong, durMin, score: Number(a.score ?? 0), tabs: Number(a.tab_switches ?? 0) };
    });
    const maxScore = Math.max(1, ...info.map((i: any) => i.score));

    // pairwise wrong-overlap + full similarity
    const pairFlag = new Map<string, string[]>();
    for (let i = 0; i < info.length; i++) {
      for (let j = i + 1; j < info.length; j++) {
        const A = info[i], B = info[j];
        const shared = Array.from(A.wrong).filter((q) => B.wrong.has(q));
        const denom = Math.min(A.wrong.size, B.wrong.size);
        if (denom >= 5 && shared.length / denom >= 0.7) {
          const msg = `تطابق ${Math.round((shared.length / denom) * 100)}% في ${shared.length} أخطاء مشتركة`;
          pairFlag.set(A.sid, [...(pairFlag.get(A.sid) ?? []), msg]);
          pairFlag.set(B.sid, [...(pairFlag.get(B.sid) ?? []), msg]);
        }
        const common = A.qids.filter((q) => B.qids.includes(q));
        if (common.length >= 5) {
          const same = common.filter((q) => norm(A.ans[q]) === norm(B.ans[q])).length;
          if (same / common.length >= 0.9) {
            const msg = `تطابق كلي ${Math.round((same / common.length) * 100)}% في ${common.length} إجابات`;
            pairFlag.set(A.sid, [...(pairFlag.get(A.sid) ?? []), msg]);
            pairFlag.set(B.sid, [...(pairFlag.get(B.sid) ?? []), msg]);
          }
        }
      }
    }

    // timing: الأسرع (تحت P25) + درجة ≥90%
    const durs = info.map((i) => i.durMin).filter((d): d is number => d !== null && d > 0.2).sort((a, b) => a - b);
    const p25 = durs.length >= 4 ? durs[Math.floor(durs.length * 0.25)] : null;

    const durMinExam = Number((exam as any).duration_minutes ?? 30);
    const flags: any[] = [];
    for (const i of info) {
      let score = 0;
      const ev: string[] = [];
      const pf = pairFlag.get(i.sid) ?? [];
      if (pf.length) { score += 25; ev.push(...pf); }
      if (p25 !== null && i.durMin !== null && i.durMin < p25 && i.score / maxScore >= 0.9) {
        score += 35;
        ev.push(`حل سريع (${i.durMin.toFixed(1)} دقيقة) مع درجة ${i.score}/${maxScore}`);
      }
      const tabRate = i.durMin ? i.tabs / Math.max(1, i.durMin) : i.tabs;
      if ((durMinExam <= 30 && i.tabs > 5) || tabRate > 0.3) {
        score += 20;
        ev.push(`${i.tabs} تبديل تبويب أثناء الحل`);
      }
      if (pf.some((m) => m.startsWith("تطابق كلي"))) score += 20;
      score = Math.min(100, score);
      if (score >= 40) flags.push({ student_id: i.sid, score, level: score >= 70 ? "high" : "review", evidence: ev.slice(0, 4) });
    }
    flags.sort((a, b) => b.score - a.score);

    const sids = flags.map((f) => f.student_id);
    let names: Record<string, string> = {};
    if (sids.length) {
      const { data: st } = await admin.from("users").select("id,full_name").in("id", sids);
      (st ?? []).forEach((s: any) => { names[s.id] = s.full_name; });
    }
    return NextResponse.json({
      ok: true, attempts: rows.length,
      flags: flags.map((f) => ({ ...f, student: names[f.student_id] ?? "—" })),
      disclaimer: "مؤشرات إحصائية تستحق المراجعة — لا تثبت الغش وحدها.",
    });
  } catch (e: any) {
    return dbFail("suspicion", e);
  }
}
