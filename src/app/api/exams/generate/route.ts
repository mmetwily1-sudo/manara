import { NextResponse } from "next/server";
import { isMissingTable } from "@/lib/server-auth";

/**
 * POST /api/exams/generate — توليد امتحان بضغطة، بوضعين:
 *
 * 1) curriculum (موصى به): { trackCode, subject, lessonCodes?, distribution, bookIds?, qtypeMix?, excludeRecent? }
 *    توزيع طبقي (stratified) على دروس المنهج بأوزانها الامتحانية، مع:
 *    - استبعاد أسئلة آخر 10 امتحانات (منع التكرار)
 *    - تقرير تغطية لكل درس (المطلوب/المتاح/المنفذ)
 * 2) legacy: { distribution } فقط — سحب عشوائي بالصعوبة كما قبل (يتطلب بنك المعلم فقط)
 */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const b = Math.floor(Math.random() * (i + 1));
    [a[i], a[b]] = [a[b], a[i]];
  }
  return a;
}

/** توزيع عدد صحيح على أوزان (largest remainder) */
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let rest = total - out.reduce((s, x) => s + x, 0);
  const order = exact
    .map((e, i) => ({ frac: e - Math.floor(e), i }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rest && k < order.length; k++) out[order[k].i]++;
  return out;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const { groupId, title, distribution, duration } = body ?? {};
  const { trackCode, subject, lessonCodes, bookIds, qtypeMix, excludeRecent } = body ?? {};
  if (!title?.trim() || !distribution || typeof distribution !== "object") {
    return NextResponse.json({ ok: false, error: "title+distribution required" }, { status: 400 });
  }

  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tenantId = res.ctx.tenantId;

  const levels = Object.entries(distribution as Record<string, number>)
    .map(([k, v]) => ({ diff: Number(k), want: Math.max(0, Number(v) || 0) }))
    .filter((l) => l.want > 0 && l.diff >= 1 && l.diff <= 5);
  const totalWant = levels.reduce((s, l) => s + l.want, 0);
  if (!totalWant) return NextResponse.json({ ok: false, error: "empty_distribution" }, { status: 400 });

  // 1) إنشاء الامتحان أولاً
  const { data: exam, error: eErr } = await admin.from("exams").insert({
    tenant_id: tenantId, group_id: groupId ?? null, title: title.trim(),
    duration_minutes: Math.max(1, Math.min(180, Number(duration ?? 30) || 30)), total_marks: 0,
  }).select("id").single();
  if (eErr || !exam) return NextResponse.json({ ok: false, error: eErr?.message ?? "create_failed" }, { status: 500 });

  try {
    // ---------- الوضع المرجعي (منهج) ----------
    if (trackCode && subject) {
      const out = await generateCurriculum(admin, tenantId, (exam as any).id, {
        trackCode: String(trackCode), subject: String(subject),
        lessonCodes: Array.isArray(lessonCodes) ? lessonCodes.map(String) : null,
        bookIds: Array.isArray(bookIds) ? bookIds.map(String) : null,
        qtypeMix: qtypeMix && typeof qtypeMix === "object" ? qtypeMix : null,
        levels, totalWant,
        excludeRecent: excludeRecent !== false,
      });
      return NextResponse.json({ ok: true, examId: (exam as any).id, mode: "curriculum", ...out });
    }

    // ---------- الوضع القديم (توافق) ----------
    const pools = await Promise.all(
      levels.map((l) =>
        admin.from("questions").select("id,marks").eq("tenant_id", tenantId).eq("difficulty", l.diff).limit(200)
      )
    );
    const picked: any[] = [];
    const pickedCount: Record<number, number> = {};
    let pos = 0, totalMarks = 0;
    levels.forEach((l, i) => {
      const pool = shuffle([...(pools[i].data ?? [])]);
      const take = pool.slice(0, Math.min(l.want, pool.length));
      pickedCount[l.diff] = take.length;
      for (const q of take) {
        const m = Number((q as any).marks ?? 1);
        picked.push({ exam_id: (exam as any).id, question_id: (q as any).id, tenant_id: tenantId, position: pos++, marks: m });
        totalMarks += m;
      }
    });
    if (picked.length) {
      const { error: linkErr } = await admin.from("exam_questions").insert(picked);
      if (linkErr) throw new Error(linkErr.message);
      await admin.from("exams").update({ total_marks: totalMarks }).eq("id", (exam as any).id);
      await bumpUsage(admin, picked.map((p) => p.question_id));
    }
    return NextResponse.json({
      ok: true, examId: (exam as any).id, mode: "legacy",
      picked: picked.length, totalMarks, pickedCount,
      shortfall: levels.some((l) => (pickedCount[l.diff] ?? 0) < l.want),
    });
  } catch (e: any) {
    await admin.from("exams").delete().eq("id", (exam as any).id);
    const msg = e?.message ?? "generate_failed";
    const status =
      msg === "track_not_found" || msg === "no_lessons" ? 400
      : msg === "curriculum_not_ready" ? 500 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

/** usage_count + 1 لكل الأسئلة المختارة — استدعاء واحد، وفشل صامت عند غياب الدالة */
async function bumpUsage(admin: any, ids: string[]) {
  if (!ids.length) return;
  try {
    await admin.rpc("bump_questions_usage", { qids: ids });
  } catch {}
}

type CurrOpts = {
  trackCode: string; subject: string;
  lessonCodes: string[] | null; bookIds: string[] | null;
  qtypeMix: Record<string, number> | null;
  levels: { diff: number; want: number }[];
  totalWant: number; excludeRecent: boolean;
};

async function generateCurriculum(admin: any, tenantId: string, examId: string, o: CurrOpts) {
  // المسار + الدروس
  const { data: track, error: tErr } = await admin
    .from("curriculum_tracks").select("id,grade_ar,stream_ar").eq("code", o.trackCode).single();
  if (isMissingTable(tErr)) throw new Error("curriculum_not_ready");
  if (tErr || !track) throw new Error("track_not_found");

  let lq = admin
    .from("curriculum_lessons")
    .select("code,lesson_title,unit_title,weight")
    .eq("track_id", (track as any).id)
    .eq("subject", o.subject)
    .order("unit_no", { ascending: true })
    .order("lesson_no", { ascending: true });
  if (o.lessonCodes?.length) lq = lq.in("code", o.lessonCodes);
  const { data: lessons, error: lErr } = await lq;
  if (isMissingTable(lErr)) throw new Error("curriculum_not_ready");
  if (!lessons?.length) throw new Error("no_lessons");

  // الأسئلة المستخدمة حديثاً (آخر 10 امتحانات للسنتر) — تُستبعد
  let recentIds: string[] = [];
  if (o.excludeRecent) {
    const { data: recentExams } = await admin
      .from("exams").select("id").eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }).limit(10);
    const eids = (recentExams ?? []).map((e: any) => e.id).filter((id: string) => id !== examId);
    if (eids.length) {
      const { data: used } = await admin
        .from("exam_questions").select("question_id").in("exam_id", eids).limit(2000);
      recentIds = (used ?? []).map((u: any) => u.question_id);
    }
  }
  const recentSet = new Set(recentIds);

  // حصة كل درس من الإجمالي حسب الوزن
  const quotas = apportion(o.totalWant, (lessons as any[]).map((l) => Number(l.weight) || 1));
  const diffShare = new Map(o.levels.map((l) => [l.diff, l.want / o.totalWant]));

  // أحواض الدروس بالتوازي
  const pools = await Promise.all(
    (lessons as any[]).map((l) => {
      let q = admin
        .from("questions")
        .select("id,difficulty,qtype,marks,lesson_code")
        .eq("tenant_id", tenantId)
        .eq("lesson_code", l.code)
        .limit(200);
      if (o.bookIds?.length) q = q.in("book_id", o.bookIds);
      return q;
    })
  );

  const picked: any[] = [];
  const coverage: Record<string, { title: string; wanted: number; picked: number; available: number }> = {};
  let pos = 0, totalMarks = 0;

  (lessons as any[]).forEach((l, li) => {
    const quota = quotas[li];
    const pool = shuffle([...((pools[li].data ?? []) as any[])].filter((q) => !recentSet.has(q.id)));
    const available = pool.length;
    // حصة الصعوبة داخل الدرس بنفس نسب التوزيع العامة
    const wantByDiff = new Map<number, number>();
    let assigned = 0;
    o.levels.forEach((lv, i) => {
      const w = i === o.levels.length - 1 ? quota - assigned : Math.round(quota * (diffShare.get(lv.diff) ?? 0));
      wantByDiff.set(lv.diff, Math.max(0, w));
      assigned += Math.max(0, w);
    });
    // نوع السؤال (اختياري): رشّح الحوض أولاً
    let usable = pool;
    if (o.qtypeMix) {
      const wantedTypes = Object.entries(o.qtypeMix).filter(([, n]) => Number(n) > 0).map(([t]) => t);
      if (wantedTypes.length) {
        const match = pool.filter((q) => wantedTypes.includes(q.qtype));
        if (match.length >= Math.min(quota, 1)) usable = match;
      }
    }
    const byDiff = new Map<number, any[]>();
    for (const q of usable) {
      const d = Number(q.difficulty) || 2;
      if (!byDiff.has(d)) byDiff.set(d, []);
      byDiff.get(d)!.push(q);
    }
    let got = 0;
    const taken = new Set<string>();
    for (const lv of o.levels) {
      const bucket = shuffle(byDiff.get(lv.diff) ?? []);
      const need = wantByDiff.get(lv.diff) ?? 0;
      for (const q of bucket) {
        if (got >= quota) break;
        if (taken.has(q.id)) continue;
        taken.add(q.id);
        const m = Number(q.marks ?? 1);
        picked.push({ exam_id: examId, question_id: q.id, tenant_id: tenantId, position: pos++, marks: m });
        totalMarks += m;
        got++;
      }
      if (got >= quota) break;
    }
    // إكمال من أي صعوبة عند العجز (أفضل من ترك فراغ)
    if (got < quota) {
      for (const q of usable) {
        if (got >= quota) break;
        if (taken.has(q.id)) continue;
        taken.add(q.id);
        const m = Number(q.marks ?? 1);
        picked.push({ exam_id: examId, question_id: q.id, tenant_id: tenantId, position: pos++, marks: m });
        totalMarks += m;
        got++;
      }
    }
    coverage[l.code] = { title: l.lesson_title, wanted: quota, picked: got, available };
  });

  if (picked.length) {
    const { error: linkErr } = await admin.from("exam_questions").insert(picked);
    if (linkErr) throw new Error(linkErr.message);
    await admin.from("exams").update({
      total_marks: totalMarks,
      track_id: (track as any).id,
      subject: o.subject,
      coverage,
    }).eq("id", examId);
    await bumpUsage(admin, picked.map((p) => p.question_id));
  }

  const shortfall = Object.values(coverage).some((c) => c.picked < c.wanted);
  return {
    picked: picked.length, totalMarks, coverage,
    shortfall,
    track: { grade: (track as any).grade_ar, stream: (track as any).stream_ar },
  };
}
