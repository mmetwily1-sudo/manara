import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, { cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } } });
}

/**
 * POST /api/exams/generate — توليد امتحان بضغطة
 * محسّن للأداء: كل الاستعلامات المتوازية + إدخال واحد مجمّع
 * (كان ~11 استدعاء متسلسلاً يتجاوز مهلة Vercel — الآن ~4 قفزات فقط)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  const { groupId, title, distribution, duration } = body ?? {};
  if (!title?.trim() || !distribution || typeof distribution !== "object") {
    return NextResponse.json({ ok: false, error: "title+distribution required" }, { status: 400 });
  }

  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const urow = { tenant_id: res.ctx.tenantId };

  // 1) إنشاء الامتحان أولاً
  const { data: exam, error: eErr } = await admin.from("exams").insert({
    tenant_id: urow.tenant_id, group_id: groupId ?? null, title: title.trim(),
    duration_minutes: Math.max(1, Math.min(180, Number(duration ?? 30) || 30)), total_marks: 0,
  }).select("id").single();
  if (eErr || !exam) return NextResponse.json({ ok: false, error: eErr?.message ?? "create_failed" }, { status: 500 });

  try {
    // 2) جلب أحواض كل مستوى بالتوازي (3 استعلامات في قفزة واحدة)
    const levels = Object.entries(distribution as Record<string, number>)
      .map(([k, v]) => ({ diff: Number(k), want: Math.max(0, Number(v) || 0) }))
      .filter((l) => l.want > 0 && l.diff >= 1 && l.diff <= 5);
    const pools = await Promise.all(
      levels.map((l) =>
        admin.from("questions")
          .select("id,marks")
          .eq("tenant_id", urow.tenant_id)
          .eq("difficulty", l.diff)
          .limit(200)
      )
    );

    // 3) خلط واختيار + إدخال واحد مجمّع
    const picked: { exam_id: string; question_id: string; tenant_id: string; position: number; marks: number }[] = [];
    const pickedCount: Record<number, number> = {};
    const available: Record<number, number> = {};
    let pos = 0, totalMarks = 0;
    levels.forEach((l, i) => {
      const pool = [...(pools[i].data ?? [])];
      available[l.diff] = pool.length;
      for (let a = pool.length - 1; a > 0; a--) {
        const b = Math.floor(Math.random() * (a + 1));
        [pool[a], pool[b]] = [pool[b], pool[a]];
      }
      const take = pool.slice(0, Math.min(l.want, pool.length));
      pickedCount[l.diff] = take.length;
      for (const q of take) {
        const m = Number((q as any).marks ?? 1);
        picked.push({ exam_id: exam.id, question_id: (q as any).id, tenant_id: urow.tenant_id, position: pos++, marks: m });
        totalMarks += m;
      }
    });

    if (picked.length) {
      const { error: linkErr } = await admin.from("exam_questions").insert(picked);
      if (linkErr) throw new Error(linkErr.message);
      await admin.from("exams").update({ total_marks: totalMarks }).eq("id", exam.id);
    }

    return NextResponse.json({
      ok: true, examId: exam.id,
      picked: picked.length, totalMarks,
      pickedCount, available,
      shortfall: levels.some((l) => (pickedCount[l.diff] ?? 0) < l.want),
    });
  } catch (e: any) {
    // تنظيف الامتحان الفارغ عند أي فشل
    await admin.from("exams").delete().eq("id", exam.id);
    return NextResponse.json({ ok: false, error: e?.message ?? "generate_failed" }, { status: 500 });
  }
}
