import { visionChain } from "./vision";

/**
 * وكيل منارة (مساعد المعلم) — حلقة ReAct خام فوق Gemini REST:
 * سبب → استدعاء أداة (APIs السنتر) → ملاحظة → تكرار (سقف 5 خطوات).
 * بلا اعتماديات جديدة. النشر يبقى يدوياً دائماً (الوكيل ينشئ مسودات/امتحانات غير منشورة فقط).
 */

const MAX_STEPS = 5;

const SYSTEM = `أنت مساعد المعلم في منصة منارة (عربي، مختصر، عملي).
لديك أدوات حقيقية لبنك الأسئلة والامتحانات — استخدمها بدل التخمين.
قواعد صارمة:
- إذا طلب امتحاناً مباشرة (مادة/عدد/عنوان) استدعِ create_exam فوراً دون إحصاء مسبق — الأداة تتحقق من البنك بنفسها.
- استدعِ bank_stats فقط عند السؤال عن محتوى البنك («عندنا إيه؟»).
- لا تنشر أي امتحان أبداً — أنشئه غير منشور واذكر أنه بانتظار مراجعته ونشره.
- لا تخترع أسئلة من عندك — ابنِ من البنك فقط، وإن كان فارغاً قل ذلك بوضوح.
- أجب بالعربية الفصحى المبسطة بجمل قصيرة، واذكر ما فعلته بأدواتك.
- review_exam هو المدقق الثاني: بعد إنشاء أي امتحان راجعه به قبل تسليم الإجابة.
- attendance_summary وstudent_progress للأسئلة عن الحضور والطلاب — لا تخترع أرقاماً أبداً.`;

/** اقتراحات متابعة حتمية (بلا تكلفة) حسب آخر أداة ناجحة */
export function followUps(steps: { tool: string; ok: boolean }[]): string[] {
  const last = [...steps].reverse().find((s) => s.ok)?.tool;
  if (last === "create_exam") return ["راجع الامتحان الجديد", "اعمل امتحانًا لمادة أخرى", "عندنا إيه في البنك؟"];
  if (last === "bank_stats") return ["اعمل امتحان من البنك", "اعرض أحدث الامتحانات"];
  if (last === "review_exam") return ["اعرض أحدث الامتحانات", "اعمل امتحانًا جديدًا"];
  if (last === "attendance_summary") return ["تفاصيل طالب معين", "اعرض أحدث الامتحانات"];
  if (last === "student_progress") return ["ملخص الحضور", "اعمل امتحانًا جديدًا"];
  if (last === "list_exams") return ["راجع أحدث امتحان", "اعمل امتحانًا جديدًا"];
  return ["عندنا إيه في البنك؟", "اعمل امتحان علوم 5 أسئلة", "ملخص الحضور"];
}

const DECLARATIONS = [
  {
    name: "bank_stats",
    description: "إحصاء بنك الأسئلة: عدد المعتمد حسب المادة (اختياري). استخدمها قبل إنشاء امتحان.",
    parameters: {
      type: "OBJECT",
      properties: { subject: { type: "STRING", description: "المادة للفلترة (اختياري)" } },
    },
  },
  {
    name: "create_exam",
    description: "إنشاء امتحان غير منشور من بنك الأسئلة المعتمدة وربط أسئلته تلقائياً.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "عنوان الامتحان" },
        subject: { type: "STRING", description: "المادة (اختياري — كل المواد إن ترك فارغاً)" },
        count: { type: "NUMBER", description: "عدد الأسئلة (1-50، الافتراضي 5)" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_exams",
    description: "أحدث الامتحانات: العنوان وعدد الأسئلة وحالة النشر.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "attendance_summary",
    description: "ملخص الحضور: إجمالي المسجلين ونسبة الحضور آخر 7 أيام.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "student_progress",
    description: "نبذة طالب بالاسم: نقاطه وأوسمته وآخر نتائجه وواجباته.",
    parameters: {
      type: "OBJECT",
      properties: { name: { type: "STRING", description: "اسم الطالب (جزء من الاسم يكفي)" } },
      required: ["name"],
    },
  },
  {
    name: "review_exam",
    description: "مراجعة امتحان (مدقق ثانٍ): أسئلة بلا إجابة، إجابة لا تطابق الخيارات، تكرار، نص ناقص.",
    parameters: {
      type: "OBJECT",
      properties: { exam_id: { type: "STRING", description: "معرف الامتحان (اختياري — الأحدث إن ترك فارغاً)" } },
    },
  },
];

export type AgentHistory = { role: "user" | "assistant"; text: string };

async function gemini(
  key: string, model: string, contents: unknown[], timeoutMs = 60000
): Promise<{ text: string; call: { name: string; args: Record<string, unknown> } | null; rawError?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents,
          tools: [{ function_declarations: DECLARATIONS }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
      }
    );
    const j = await r.json().catch(() => null);
    if (!r.ok) return { text: "", call: null, rawError: "api:" + r.status };
    const parts: any[] = j?.candidates?.[0]?.content?.parts ?? [];
    const fc = parts.find((p) => p.functionCall);
    if (fc) return { text: "", call: { name: fc.functionCall.name, args: (fc.functionCall.args ?? {}) as Record<string, unknown> } };
    return { text: parts.map((p) => p.text ?? "").join("").trim(), call: null };
  } catch {
    return { text: "", call: null, rawError: "network" };
  } finally {
    clearTimeout(timer);
  }
}

async function execTool(admin: any, tid: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "bank_stats") {
    let q = admin.from("questions").select("subject,difficulty").eq("tenant_id", tid).eq("status", "approved").limit(2000);
    if (args.subject) q = q.ilike("subject", `%${String(args.subject).slice(0, 40)}%`);
    const { data, error } = await q;
    if (error) return { error: "db" };
    const by: Record<string, number> = {};
    for (const r of (data ?? []) as any[]) by[String(r.subject ?? "عام")] = (by[String(r.subject ?? "عام")] ?? 0) + 1;
    return { total: (data ?? []).length, bySubject: by };
  }
  if (name === "create_exam") {
    const count = Math.min(50, Math.max(1, Math.floor(Number(args.count ?? 5)) || 5));
    const title = String(args.title ?? "امتحان").slice(0, 120);
    let q = admin.from("questions").select("id,marks").eq("tenant_id", tid).eq("status", "approved").limit(500);
    if (args.subject) q = q.ilike("subject", `%${String(args.subject).slice(0, 40)}%`);
    const { data, error } = await q;
    if (error) return { error: "db" };
    const pool = ((data ?? []) as any[]).sort(() => Math.random() - 0.5).slice(0, count);
    if (!pool.length) {
      // هل توجد مسودات غير معتمدة لنفس المادة؟ (توجيه عملي بدل الرفض الصامت)
      let q2 = admin.from("questions").select("id", { count: "exact", head: true })
        .eq("tenant_id", tid).eq("status", "draft");
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
  if (name === "attendance_summary") {
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await admin.from("attendance").select("status")
      .eq("tenant_id", tid).gte("recorded_at", week).limit(2000);
    if (error) return { error: "db" };
    const rows = (data ?? []) as any[];
    const present = rows.filter((r) => r.status === "present").length;
    return {
      records: rows.length,
      present,
      rate: rows.length ? Math.round((present / rows.length) * 100) : null,
      window: "7d",
    };
  }
  if (name === "student_progress") {
    const needle = String(args.name ?? "").trim().slice(0, 60);
    if (needle.length < 2) return { error: "need_name" };
    const { data: students } = await admin.from("users").select("id,full_name,points")
      .eq("tenant_id", tid).eq("role", "student").ilike("full_name", `%${needle}%`).limit(5);
    const list = (students ?? []) as any[];
    if (!list.length) return { error: "not_found", message: "لا يوجد طالب بهذا الاسم" };
    if (list.length > 1) return { multiple: list.map((s) => s.full_name), message: "أسماء متعددة — حدد واحداً" };
    const st = list[0];
    const [{ data: subs }, { data: attempts }] = await Promise.all([
      admin.from("submissions").select("status,score").eq("tenant_id", tid).eq("student_id", st.id).limit(50),
      admin.from("exam_attempts").select("score,exams(title,total_marks)").eq("tenant_id", tid).eq("student_id", st.id).order("submitted_at", { ascending: false }).limit(5),
    ]);
    const graded = ((subs ?? []) as any[]).filter((s) => s.status === "graded");
    return {
      name: st.full_name, points: Number(st.points ?? 0) || 0,
      homework_graded: graded.length,
      last_exams: ((attempts ?? []) as any[]).map((a) => ({
        title: (a.exams as any)?.title ?? "امتحان",
        score: a.score, total: Number((a.exams as any)?.total_marks ?? 0) || 0,
      })),
    };
  }
  if (name === "review_exam") {
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
  if (name === "list_exams") {
    const { data: exams } = await admin.from("exams").select("id,title,is_published,created_at")
      .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(10);
    const ids = ((exams ?? []) as any[]).map((e) => e.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: links } = await admin.from("exam_questions").select("exam_id").in("exam_id", ids);
      for (const l of (links ?? []) as any[]) counts[l.exam_id] = (counts[l.exam_id] ?? 0) + 1;
    }
    return ((exams ?? []) as any[]).map((e) => ({
      title: e.title, questions: counts[e.id] ?? 0, published: !!e.is_published,
    }));
  }
  return { error: "unknown_tool" };
}

/** ملخص حتمي من آخر نتيجة أداة — يُستخدم عند تعثر الصياغة اللغوية */
function fallbackSummary(last: { tool: string; out: unknown } | null): string {
  const o = (last?.out ?? {}) as any;
  if (last?.tool === "create_exam" && o.error === "empty_bank") {
    const subj = o.subject ? ` لمادة «${o.subject}»` : "";
    const subjName = o.subject ? ` ${o.subject}` : "";
    const draftHint = o.drafts > 0
      ? ` عندك ${o.drafts} مسودات${subjName} بانتظار الاعتماد في بنك الأسئلة — اعتمدها أولاً ثم اطلب الامتحان.`
      : ` الحل: امسح ورقة${subjName || " المادة"} بالكاميرا من بنك الأسئلة وسأتولى الباقي.`;
    return `لا توجد أسئلة معتمدة${subj} في بنكك.${draftHint}`;
  }
  if (last?.tool === "create_exam" && o.error) {
    return "تعذر إنشاء الامتحان لعطل تقني — حاول بعد قليل، وإن تكرر أخبر الدعم.";
  }
  if (last?.tool === "create_exam" && o.exam_id) {
    return `تم إنشاء امتحان «${o.title}» (${o.count} أسئلة، ${o.total_marks} درجات) — غير منشور. راجعه من صفحة الامتحانات ثم انشره.`;
  }
  if (last?.tool === "bank_stats" && typeof o.total === "number") {
    const parts = Object.entries((o.bySubject ?? {}) as Record<string, number>)
      .map(([k, v]) => `${k}: ${v}`).join("، ");
    return `في بنكك ${o.total} أسئلة معتمدة${parts ? ` (${parts})` : ""}. اطلب مثلاً: «اعمل امتحان علوم 5 أسئلة».`;
  }
  if (last?.tool === "list_exams" && Array.isArray(o)) {
    if (!o.length) return "لا توجد امتحانات بعد — اطلب إنشاء واحد من بنكك.";
    return "أحدث امتحاناتك: " + o.slice(0, 5).map((e: any) => `«${e.title}» (${e.questions} أسئلة${e.published ? "، منشور" : ""})`).join("؛ ");
  }
  return "تعذر الوصول لخدمة الذكاء حالياً (ازدحام) — حاول بعد قليل.";
}

export async function runAgent(
  admin: any, tid: string, history: AgentHistory[], tenantKey?: string | null, tenantKey2?: string | null,
  onStep?: (s: { tool: string; ok: boolean }) => void
): Promise<{ text: string; steps: { tool: string; ok: boolean }[] }> {
  const keys = visionChain(tenantKey, tenantKey2);
  if (!keys.length) return { text: "لا يوجد مفتاح رؤية — اربط مفتاح Gemini من الإعدادات أولاً.", steps: [] };
  const models = ["gemini-flash-latest", "gemini-3-flash-preview"];

  const contents: any[] = history.slice(-10).map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.text.slice(0, 2000) }],
  }));

  const steps: { tool: string; ok: boolean }[] = [];
  let lastResult: { tool: string; out: unknown } | null = null;
  for (let s = 0; s < MAX_STEPS; s++) {
    let res: { text: string; call: { name: string; args: Record<string, unknown> } | null; rawError?: string } | null = null;
    for (const key of keys) {
      for (const model of models) {
        res = await gemini(key, model, contents);
        if (res.call || res.text) break;
        // أي فشل (429/503/شبكة) → الموديل/المفتاح التالي بدل الاستسلام
      }
      if (res && (res.call || res.text)) break;
    }
    if (!res || (!res.call && !res.text)) {
      return { text: fallbackSummary(lastResult), steps };
    }
    if (!res.call) return { text: res.text || "لم أفهم — أعد الصياغة.", steps };
    // تنفيذ الأداة وإرجاع نتيجتها للحلقة
    let out: unknown;
    try {
      out = await execTool(admin, tid, res.call.name, res.call.args);
    } catch {
      out = { error: "tool_failed" };
    }
    const ok = !(out as any)?.error;
    const st = { tool: res.call.name, ok };
    steps.push(st);
    try { onStep?.(st); } catch {}
    lastResult = { tool: res.call.name, out };
    contents.push({ role: "model", parts: [{ functionCall: res.call }] });
    contents.push({ role: "user", parts: [{ functionResponse: { name: res.call.name, response: out as object } }] });
  }
  return { text: "نفذت الخطوات لكن المهمة تحتاج تبسيطاً — اطلب عدداً أقل أو مادة محددة.", steps };
}
