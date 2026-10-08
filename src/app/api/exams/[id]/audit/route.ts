import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";

/**
 * POST /api/exams/[id]/audit — تدقيق آلي لأسئلة الامتحان قبل النشر.
 * 1) فحوص حتمية: خيارات ناقصة/إجابة غائبة أو لا تطابق الخيارات/نص قصير/عنصر نائب/تكرار.
 * 2) إصلاحات تنسيق آمنة تُطبق فوراً (تقليم فراغات، حذف خيارات فارغة).
 * 3) تحقق لغوي واحد مجمّع (Gemini detective): يعيد حكماً لكل سؤال،
 *    ويُصحَّح تلقائياً فقط ما يطابق خياراً موجوداً حرفياً — الباقي تنبيهات.
 * المراجعة البشرية تبقى مطلوبة للنشر، لكن التقرير يختصرها لدقائق.
 */

type Warn = { n: number; question_id: string; body: string; issues: string[]; suggested?: string | null };

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  // التدقيق يستهلك مكالمة لغوية — 20/ساعة لكل سنتر
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (await isRateLimited(_req, "audit", 20, 60 * 60 * 1000, tid)) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "تجاوزت حد التدقيق (20/ساعة) — انتظر قليلاً." }, { status: 429 });
  }

  const { data: exam } = await admin
    .from("exams").select("id,title").eq("id", params.id).eq("tenant_id", tid).single();
  if (!exam) return NextResponse.json({ ok: false, error: "exam_not_found" }, { status: 404 });

  const { data: eqs } = await admin
    .from("exam_questions")
    .select("position,questions(id,body,options,correct_answer,qtype)")
    .eq("exam_id", params.id)
    .eq("tenant_id", tid)
    .order("position", { ascending: true });
  const rows = ((eqs ?? []) as any[]).map((r, i) => ({ n: i + 1, ...(r.questions ?? {}) }));
  if (!rows.length) {
    return NextResponse.json({ ok: true, total: 0, fixed: [], warnings: [], note: "empty_exam" });
  }

  const fixed: string[] = [];
  const warnings: Warn[] = [];
  const seen = new Map<string, number>();

  for (const q of rows) {
    const issues: string[] = [];
    const body = String(q.body ?? "").trim();
    let opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    const cleanOpts = opts.map((o) => String(o ?? "").trim()).filter(Boolean);
    if (cleanOpts.length !== opts.length) {
      await admin.from("questions").update({ options: cleanOpts.length >= 2 ? cleanOpts : opts }).eq("id", q.id);
      if (cleanOpts.length >= 2) { fixed.push(`س${q.n}: حذف خيارات فارغة`); opts = cleanOpts; }
    }
    if (body !== q.body) {
      await admin.from("questions").update({ body }).eq("id", q.id);
      fixed.push(`س${q.n}: تقليم فراغات النص`);
    }
    if (!body || body.length < 5 || body.startsWith("[صفحة")) issues.push("نص ناقص أو عنصر يدوي");
    if (opts.length < 2) issues.push(`خيارات ناقصة (${opts.length})`);
    const ans = String(q.correct_answer ?? "").trim();
    if (!ans) issues.push("بلا إجابة صحيحة");
    else if (opts.length >= 2 && !opts.includes(ans)) issues.push("الإجابة لا تطابق أي خيار");
    const key = body.slice(0, 120);
    if (key && seen.has(key)) issues.push(`مكرر مع س${seen.get(key)}`);
    else if (key) seen.set(key, q.n);
    if (issues.length) warnings.push({ n: q.n, question_id: q.id, body: body.slice(0, 80), issues });
  }

  // 3) تحقق لغوي مجمّع — مكالمة واحدة مهما بلغ عدد الأسئلة (توفير الحصة)
  let llmNote: string | null = null;
  let llmChecked = 0;
  const answerable = rows.filter(
    (q) => Array.isArray(q.options) && q.options.length >= 2 && String(q.correct_answer ?? "").trim()
  );
  if (answerable.length) {
    try {
      const { data: trow } = await admin.from("tenants").select("settings").eq("id", tid).single();
      const tk = (trow as any)?.settings?.vision_key ?? null;
      const tk2 = (trow as any)?.settings?.vision_key_2 ?? null;
      const { visionChain } = await import("@/lib/vision");
      const keys = visionChain(tk, tk2);
      if (!keys.length) {
        llmNote = "no_key";
      } else {
        const batch = answerable.map((q) => ({
          n: q.n,
          q: String(q.body).slice(0, 300),
          options: (q.options as string[]).slice(0, 6),
          claimed: String(q.correct_answer),
        }));
        const prompt =
          "You are an expert Egyptian curriculum teacher. For each item, judge whether the claimed correct answer is right. "
          + "Return ONLY a JSON array, no markdown: [{\"n\": 1, \"verdict\": \"ok|wrong|unsure\", \"fix\": \"exact correct option text or empty\"}]. "
          + "fix must be copied EXACTLY from the given options. Items: " + JSON.stringify(batch).slice(0, 6000);
        let verdicts: any[] = [];
        for (const key of keys) {
          try {
            const r = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + key,
              {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0, maxOutputTokens: 2000 },
                }),
              }
            );
            const jj = await r.json().catch(() => null);
            const text: string = jj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
            if (r.ok && text) {
              const clean = text.replace(/```json|```/g, "").trim();
              const arr = JSON.parse(clean.slice(clean.indexOf("["), clean.lastIndexOf("]") + 1));
              if (Array.isArray(arr)) { verdicts = arr; break; }
            }
            if (r.status !== 429) break;
          } catch { break; }
        }
        if (!verdicts.length) {
          llmNote = "llm_unavailable";
        } else {
          for (const v of verdicts) {
            const q = answerable.find((x) => x.n === v.n);
            if (!q) continue;
            llmChecked++;
            if (v.verdict === "wrong") {
              const fix = String(v.fix ?? "").trim();
              const opts = q.options as string[];
              if (fix && opts.includes(fix)) {
                await admin.from("questions").update({ correct_answer: fix }).eq("id", q.id);
                fixed.push(`س${q.n}: صُححت الإجابة تلقائياً → «${fix.slice(0, 40)}»`);
              } else {
                const w = warnings.find((x) => x.question_id === q.id);
                const msg = `النموذج اللغوي يشكك بالإجابة${fix ? ` ويقترح: «${fix.slice(0, 40)}»` : ""}`;
                if (w) w.issues.push(msg);
                else warnings.push({ n: q.n, question_id: q.id, body: String(q.body).slice(0, 80), issues: [msg] });
              }
            } else if (v.verdict === "unsure") {
              const w = warnings.find((x) => x.question_id === q.id);
              if (w) w.issues.push("النموذج اللغوي غير متأكد — راجع يدوياً");
              else warnings.push({ n: q.n, question_id: q.id, body: String(q.body).slice(0, 80), issues: ["النموذج اللغوي غير متأكد — راجع يدوياً"] });
            }
          }
        }
      }
    } catch {
      llmNote = "llm_unavailable";
    }
  }

  return NextResponse.json({
    ok: true, total: rows.length, fixed, warnings,
    llm: { checked: llmChecked, skipped: llmNote },
  });
}
