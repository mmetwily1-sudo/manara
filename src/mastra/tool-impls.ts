/**
 * تنفيذ الأدوات — مصدر واحد يستخدمه محركا الوكيل (الحلقة الخام + Mastra).
 * كل أداة: (admin, tenantId, args) => JSON آمن، بلا أسرار، وبلا نشر أبداً.
 */

export async function bankStats(admin: any, tid: string, args: { subject?: string }): Promise<unknown> {
  let q = admin.from("questions").select("subject").eq("tenant_id", tid).eq("status", "approved").limit(2000);
  if (args.subject) q = q.ilike("subject", `%${String(args.subject).slice(0, 40)}%`);
  const { data, error } = await q;
  if (error) return { error: "db" };
  const by: Record<string, number> = {};
  for (const r of (data ?? []) as any[]) by[String(r.subject ?? "عام")] = (by[String(r.subject ?? "عام")] ?? 0) + 1;
  return { total: (data ?? []).length, bySubject: by };
}

export async function createExam(
  admin: any, tid: string, args: { title: string; subject?: string; count?: number }
): Promise<unknown> {
  const count = Math.min(50, Math.max(1, Math.floor(Number(args.count ?? 5)) || 5));
  const title = String(args.title ?? "امتحان").slice(0, 120);
  let q = admin.from("questions").select("id,marks").eq("tenant_id", tid).eq("status", "approved").limit(500);
  if (args.subject) q = q.ilike("subject", `%${String(args.subject).slice(0, 40)}%`);
  const { data, error } = await q;
  if (error) return { error: "db" };
  const pool = ((data ?? []) as any[]).sort(() => Math.random() - 0.5).slice(0, count);
  if (!pool.length) {
    let q2 = admin.from("questions").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "draft");
    if (args.subject) q2 = q2.ilike("subject", `%${String(args.subject).slice(0, 40)}%`);
    const { count: drafts } = await q2;
    return { error: "empty_bank", drafts: drafts ?? 0, subject: args.subject ?? null };
  }
  const { data: ex, error: e2 } = await admin.from("exams").insert({
    tenant_id: tid, title, duration_minutes: 30, total_marks: 0, is_published: false,
  }).select("id").single();
  if (e2 || !ex) return { error: "create_failed" };
  let pos = 0, total = 0, linked = 0, linkErr: string | null = null;
  for (const qu of pool) {
    const marks = Number(qu.marks ?? 1) || 1;
    const { error: le } = await admin.from("exam_questions").insert({
      tenant_id: tid, exam_id: (ex as any).id, question_id: qu.id, position: pos++, marks,
    });
    if (le) { linkErr = String(le.message ?? le.code ?? "link_failed").slice(0, 120); break; }
    total += marks;
    linked++;
  }
  await admin.from("exams").update({ total_marks: total }).eq("id", (ex as any).id);
  if (!linked) return { error: "link_failed", message: linkErr ?? "تعذر ربط الأسئلة" };
  return { exam_id: (ex as any).id, title, count: linked, total_marks: total, published: false };
}

export async function listExams(admin: any, tid: string): Promise<unknown> {
  const { data: exams } = await admin.from("exams").select("id,title,is_published,created_at")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(10);
  const ids = ((exams ?? []) as any[]).map((e) => e.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: links } = await admin.from("exam_questions").select("exam_id").in("exam_id", ids);
    for (const l of (links ?? []) as any[]) counts[l.exam_id] = (counts[l.exam_id] ?? 0) + 1;
  }
  return ((exams ?? []) as any[]).map((e) => ({
    title: e.title, questions: counts[e.id] ?? 0, published: !!e.is_published,
  }));
}

export async function attendanceSummary(admin: any, tid: string): Promise<unknown> {
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await admin.from("attendance").select("status")
    .eq("tenant_id", tid).gte("recorded_at", week).limit(2000);
  if (error) return { error: "db" };
  const rows = (data ?? []) as any[];
  const present = rows.filter((r) => r.status === "present").length;
  return { records: rows.length, present, rate: rows.length ? Math.round((present / rows.length) * 100) : null, window: "7d" };
}

export async function studentProgress(admin: any, tid: string, args: { name: string }): Promise<unknown> {
  const needle = String(args.name ?? "").trim().slice(0, 60);
  if (needle.length < 2) return { error: "need_name" };
  const { data: students } = await admin.from("users").select("id,full_name,points")
    .eq("tenant_id", tid).eq("role", "student").ilike("full_name", `%${needle}%`).limit(5);
  const list = (students ?? []) as any[];
  if (!list.length) return { error: "not_found", message: "لا يوجد طالب بهذا الاسم" };
  if (list.length > 1) return { multiple: list.map((s) => s.full_name), message: "أسماء متعددة — حدد واحداً" };
  const st = list[0];
  const [{ data: subs }, { data: attempts }] = await Promise.all([
    admin.from("submissions").select("status").eq("tenant_id", tid).eq("student_id", st.id).limit(50),
    admin.from("exam_attempts").select("score,exams(title,total_marks)").eq("tenant_id", tid).eq("student_id", st.id).order("submitted_at", { ascending: false }).limit(5),
  ]);
  return {
    name: st.full_name, points: Number(st.points ?? 0) || 0,
    homework_graded: ((subs ?? []) as any[]).filter((s) => s.status === "graded").length,
    last_exams: ((attempts ?? []) as any[]).map((a) => ({
      title: (a.exams as any)?.title ?? "امتحان",
      score: a.score, total: Number((a.exams as any)?.total_marks ?? 0) || 0,
    })),
  };
}

export async function reviewExam(admin: any, tid: string, args: { exam_id?: string }): Promise<unknown> {
  let eid = String(args.exam_id ?? "");
  if (!eid) {
    const { data: latest } = await admin.from("exams").select("id").eq("tenant_id", tid)
      .order("created_at", { ascending: false }).limit(1).single();
    eid = (latest as any)?.id ?? "";
  }
  if (!eid) return { error: "no_exams" };
  const { data: eqs } = await admin.from("exam_questions")
    .select("questions(id,body,options,correct_answer)").eq("exam_id", eid).eq("tenant_id", tid).limit(100);
  const rows = ((eqs ?? []) as any[]).map((r) => r.questions).filter(Boolean);
  if (!rows.length) return { error: "empty_exam", message: "الامتحان بلا أسئلة مربوطة" };
  const issues: string[] = [];
  const seen = new Set<string>();
  rows.forEach((q: any, i: number) => {
    const n = i + 1;
    const body = String(q.body ?? "").trim();
    const opts = Array.isArray(q.options) ? q.options : [];
    const ans = String(q.correct_answer ?? "").trim();
    if (!body || body.length < 5 || body.startsWith("[صفحة")) issues.push(`س${n}: نص ناقص`);
    if (opts.length < 2) issues.push(`س${n}: خيارات ناقصة`);
    if (!ans) issues.push(`س${n}: بلا إجابة`);
    else if (opts.length >= 2 && !opts.includes(ans)) issues.push(`س${n}: الإجابة لا تطابق الخيارات`);
    const k = body.slice(0, 80);
    if (k && seen.has(k)) issues.push(`س${n}: مكرر`);
    else if (k) seen.add(k);
  });
  return { total: rows.length, clean: issues.length === 0, issues: issues.slice(0, 15) };
}

export type ToolCtx = { keys: string[] };

export async function generateDrafts(
  admin: any, tid: string, args: { subject: string; count?: number }, ctx?: ToolCtx
): Promise<unknown> {
  const subject = String(args.subject ?? "").trim().slice(0, 60);
  if (subject.length < 2) return { error: "need_subject", message: "حدد المادة أولاً" };
  const count = Math.min(10, Math.max(1, Math.floor(Number(args.count ?? 5)) || 5));
  const keys = ctx?.keys ?? [];
  if (!keys.length) return { error: "no_key" };

  // سياق المنهج للتأليف المرجعي
  let lessons: { lesson_title: string; code: string }[] = [];
  try {
    const { data } = await admin.from("curriculum_lessons").select("lesson_title,code")
      .ilike("subject", `%${subject}%`).limit(30);
    lessons = ((data ?? []) as any[]).map((l) => ({ lesson_title: l.lesson_title, code: l.code }));
  } catch {}

  const lessonCtx = lessons.length
    ? "الدروس المرجعية:\n" + lessons.map((l) => `- ${l.lesson_title} (${l.code})`).join("\n")
    : "بدون قائمة دروس — ألف من المنهج المصري العام لهذه المادة.";
  const prompt =
    `You are an expert Egyptian curriculum teacher. Author ${count} original Arabic multiple-choice questions ` +
    `for subject "${subject}" (Egyptian curriculum). ${lessonCtx}\n` +
    `Rules: each question has EXACTLY 4 options, exactly one correct, varied difficulty, no duplicates. ` +
    `Return ONLY a JSON array, no markdown: [{"q": "...", "options": ["..","..","..",".."], "answer": "exact correct option text", "lesson": "lesson code or empty"}]`;

  let items: any[] = [];
  let lastErr = "";
  for (const key of keys) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + key,
        {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
          }),
        }
      ).finally(() => clearTimeout(timer));
      const j = await r.json().catch(() => null);
      const text: string = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      if (r.ok && text) {
        const clean = text.replace(/```json|```/g, "").trim();
        const arr = JSON.parse(clean.slice(clean.indexOf("["), clean.lastIndexOf("]") + 1));
        if (Array.isArray(arr) && arr.length) { items = arr; break; }
      }
      lastErr = String((j as any)?.error?.message ?? r.status).slice(0, 60);
      if (r.status !== 429) break;
    } catch { lastErr = "network"; break; }
  }
  if (!items.length) return { error: "gen_failed", message: lastErr || "تعذر التوليد" };

  const { normOption } = await import("@/lib/vision");
  const rows: Record<string, unknown>[] = [];
  for (const it of items.slice(0, count)) {
    const body = String(it?.q ?? "").trim().slice(0, 2000);
    const opts = Array.isArray(it?.options) ? it.options.map((o: any) => String(o ?? "").trim()).filter(Boolean).slice(0, 4) : [];
    if (body.length < 5 || opts.length !== 4) continue;
    const ans = String(it?.answer ?? "").trim();
    const match = ans ? (opts.find((o: string) => o === ans || normOption(o) === normOption(ans)) ?? null) : null;
    rows.push({
      tenant_id: tid, subject, qtype: "mcq", body, options: opts,
      correct_answer: match, difficulty: 3, visibility: "private", status: "draft",
      source: "teacher", source_detail: JSON.stringify({ ai_generated: true }),
      lesson_code: String(it?.lesson ?? "").slice(0, 40) || null, marks: 1,
    });
  }
  if (!rows.length) return { error: "gen_failed", message: "ناتج غير صالح" };
  const { error } = await admin.from("questions").insert(rows);
  if (error) return { error: "db" };
  const withAns = rows.filter((r) => r.correct_answer).length;
  return { drafts: rows.length, with_answers: withAns, subject, note: "بانتظار مراجعتك واعتمادها من بنك الأسئلة" };
}

/** بحث قاعدة المعرفة المحلية — يعمل بلا أي AI خارجي (SQL مباشر) */
export async function searchKnowledge(
  admin: any, _tid: string, args: { query: string; kind?: string }
): Promise<unknown> {
  const q = String(args.query ?? "").trim().slice(0, 100);
  if (q.length < 2) return { error: "need_query" };
  // كلمات مفتاحية (4+ أحرف) بأولوية الأطول — مطابقة أي كلمة لا العبارة كاملة (ES5 آمن)
  const stopWords: Record<string, boolean> = { "ماذا": true, "التي": true, "الذي": true, "على": true, "إلى": true, "هذا": true, "هذه": true, "ذلك": true, "ماهي": true, "ماهو": true, "تعرف": true, "عندك": true, "عن": true, "ما": true };
  const seenW: Record<string, boolean> = {};
  const words: string[] = [];
  const parts = q.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (w.length >= 4 && !stopWords[w] && !seenW[w]) { seenW[w] = true; words.push(w); }
  }
  words.sort((a, b) => b.length - a.length);
  const top = words.slice(0, 4);
  if (!top.length) return { error: "need_query" };
  const orsArr: string[] = [];
  for (let i = 0; i < top.length; i++) orsArr.push(`title.ilike.%${top[i]}%,body.ilike.%${top[i]}%`);
  let query = admin.from("edu_knowledge").select("kind,system,title,body,source_url,effective_date")
    .or(orsArr.join(",")).limit(12);
  if (args.kind) query = query.eq("kind", String(args.kind).slice(0, 30));
  const { data, error } = await query;
  if (error) return { error: "db" };
  // ترتيب حسب عدد الكلمات المطابقة
  const scored: { r: any; hits: number }[] = [];
  for (const r of ((data ?? []) as any[])) {
    const hay = `${r.title} ${r.body}`;
    let hits = 0;
    for (let i = 0; i < top.length; i++) if (hay.indexOf(top[i]) >= 0) hits++;
    if (hits > 0) scored.push({ r, hits });
  }
  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, 6).map((x) => ({
    kind: x.r.kind, title: x.r.title,
    body: String(x.r.body).slice(0, 500),
    source: x.r.source_url, date: x.r.effective_date,
  }));
}

/** دليل الكتب الخارجية لمادة وصف (مرجع شراء للمدرس/ولي الأمر) */
export async function bookGuide(
  admin: any, _tid: string, args: { subject: string; grade?: string; system?: string }
): Promise<unknown> {
  const subject = String(args.subject ?? "").trim().slice(0, 40);
  if (subject.length < 2) return { error: "need_subject" };
  let q = admin.from("external_books").select("publisher,subject,grade,notes")
    .ilike("subject", `%${subject}%`).limit(20);
  if (args.grade) q = q.ilike("grade", `%${String(args.grade).slice(0, 20)}%`);
  if (args.system) q = q.eq("system", String(args.system).slice(0, 10));
  const { data, error } = await q;
  if (error) return { error: "db" };
  const seen: Record<string, string> = {};
  for (const r of (data ?? []) as any[]) {
    if (!(r.publisher in seen)) seen[r.publisher] = r.notes ?? "";
  }
  return {
    subject,
    books: Object.keys(seen).map((publisher) => ({ publisher, notes: seen[publisher] })),
  };
}

/** حل مسألة من البنك: بحث عن سؤال مشابه معتمد بإجابته (RAG محلي صادق — لا تخمين) */
export async function solveQuestion(
  admin: any, tid: string, args: { question: string }
): Promise<unknown> {
  const q = String(args.question ?? "").trim().slice(0, 300);
  if (q.length < 5) return { error: "need_question" };
  const words = q.split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
  if (!words.length) return { error: "need_question" };
  let query = admin.from("questions").select("body,options,correct_answer,subject")
    .eq("tenant_id", tid).eq("status", "approved").limit(50);
  for (const w of words.slice(0, 2)) query = query.ilike("body", `%${w}%`);
  const { data, error } = await query;
  if (error) return { error: "db" };
  const rows = ((data ?? []) as any[]).filter((r) => Array.isArray(r.options) && r.options.length >= 2 && r.correct_answer);
  if (!rows.length) return { error: "not_found", message: "لا يوجد سؤال مشابه محلول في بنكك" };
  const best = rows[0];
  return {
    matched: String(best.body).slice(0, 300),
    subject: best.subject, options: best.options, answer: best.correct_answer,
  };
}

/** حل امتحان كامل للمراجعة (معلم فقط — يعرض الأسئلة بإجاباتها) */
export async function solveExam(admin: any, tid: string, args: { exam_id?: string }): Promise<unknown> {
  let eid = String(args.exam_id ?? "");
  if (!eid) {
    const { data: latest } = await admin.from("exams").select("id").eq("tenant_id", tid)
      .order("created_at", { ascending: false }).limit(1).single();
    eid = (latest as any)?.id ?? "";
  }
  if (!eid) return { error: "no_exams" };
  const { data: eqs } = await admin.from("exam_questions")
    .select("questions(body,options,correct_answer)").eq("exam_id", eid).eq("tenant_id", tid).limit(100);
  const rows = ((eqs ?? []) as any[]).map((r) => r.questions).filter(Boolean);
  if (!rows.length) return { error: "empty_exam" };
  return {
    total: rows.length,
    solved: rows.map((q: any, i: number) => ({
      n: i + 1, q: String(q.body ?? "").slice(0, 200),
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.correct_answer ?? null,
    })),
  };
}

/** مساعدة التطبيق: أين كل صفحة وكيف تُنجز المهام (معرفة ثابتة منظمة) */
const APP_HELP: { keys: string[]; text: string }[] = [
  { keys: ["حضور", "تحضير", "غاب"], text: "الحضور: الداشبورد ← التحضير ← اختر المجموعة والحصة ← علّم حاضر/غائب. يدعم QR والكود. كل حضور يمنح الطالب نقطتين." },
  { keys: ["امتحان", "اختبار", "انشر", "نشر"], text: "الامتحانات: الداشبورد ← الامتحانات. الإنشاء: من بنك الأسئلة (مسح ورقة ← اعتماد) أو من المساعد «اعمل امتحان». النشر بزر «نشر» في بطاقة الامتحان بعد مراجعته." },
  { keys: ["واجب", "واجبات"], text: "الواجبات: الداشبورد ← الواجبات ← اختر المجموعة وحدد الموعد. الطالب يصوّر حله من صفحة تقدمه، وأنت تصحح بالدرجة وملاحظة من نفس الصفحة." },
  { keys: ["بابل", "omr"], text: "البابل شيت: الداشبورد ← بابل شيت OMR ← أنشئ ورقة بنموذج إجابة ← اطبعها ← صوّر الورق المظلل ← تصحيح فوري، والغامض يُعلَّم للمراجعة." },
  { keys: ["دفع", "اشتراك", "باقة", "سعر"], text: "الأسعار: 450/750/1500 شهريًا + 14 يوم تجربة + استرداد 30 يوم. الدفع أونلاين (Paymob) من صفحة الأسعار، أو واتساب للتحويل اليدوي." },
  { keys: ["طالب", "تسجيل طالب", "إضافة طالب"], text: "الطالب يسجل من رابط سنترك العام (صفحة المعلم) بالاسم ورقم الهاتف، أو تدخله برقم هاتفه للدخول بدون باسورد. تابعهم من الداشبورد ← الطلاب." },
  { keys: ["تقرير", "تقارير", "ولي الأمر"], text: "التقارير: الداشبورد ← التقارير (درجات/حضور/مدفوعات). تقارير ولي الأمر تصل واتساب تلقائيًا عند الغياب والنتائج والتصحيح." },
  { keys: ["فيديو", "حصص مسجلة"], text: "الفيديوهات: الداشبورد ← الفيديوهات ← ارفع برابط Bunny أو يوتيوب. الطالب يشاهدها من صفحة تقدمه بروابط موقعة آمنة." },
  { keys: ["متجر", "مذكرة", "بيع"], text: "المتجر: الداشبورد ← المتجر ← انشر مذكرة بسعر. الطالب يطلب من صفحته وأنت تؤكد، ثم يحمّل برابط آمن." },
  { keys: ["مساعد", "بوت", "ذكاء"], text: "أنا المساعد 🤖: ابنِ امتحانات من بنكك، ألف مسودات من المنهج، راجع الامتحانات، واسألني عن البنك والحضور والطلاب والوزارة والكتب." },
];

export async function appHelp(_admin: any, _tid: string, args: { topic: string }): Promise<unknown> {
  const t = String(args.topic ?? "").trim().slice(0, 100);
  if (t.length < 2) return { error: "need_topic" };
  const hits = APP_HELP.filter((h) => h.keys.some((k) => t.includes(k)));
  if (!hits.length) {
    return {
      hint: "مواضيع المساعدة: الحضور، الامتحانات، الواجبات، بابل شيت، الدفع، الطلاب، التقارير، الفيديو، المتجر.",
    };
  }
  return { answers: hits.slice(0, 3).map((h) => h.text) };
}

export const TOOL_IMPLS: Record<string, (admin: any, tid: string, args: Record<string, unknown>, ctx?: ToolCtx) => Promise<unknown>> = {
  bank_stats: (a, t, x) => bankStats(a, t, x as { subject?: string }),
  create_exam: (a, t, x) => createExam(a, t, x as { title: string; subject?: string; count?: number }),
  list_exams: (a, t) => listExams(a, t),
  attendance_summary: (a, t) => attendanceSummary(a, t),
  student_progress: (a, t, x) => studentProgress(a, t, x as { name: string }),
  review_exam: (a, t, x) => reviewExam(a, t, x as { exam_id?: string }),
  generate_drafts: (a, t, x, c) => generateDrafts(a, t, x as { subject: string; count?: number }, c),
  solve_question: (a, t, x) => solveQuestion(a, t, x as { question: string }),
  solve_exam: (a, t, x) => solveExam(a, t, x as { exam_id?: string }),
  app_help: (a, t, x) => appHelp(a, t, x as { topic: string }),
  search_knowledge: (a, t, x) => searchKnowledge(a, t, x as { query: string; kind?: string }),
  book_guide: (a, t, x) => bookGuide(a, t, x as { subject: string; grade?: string; system?: string }),
};
