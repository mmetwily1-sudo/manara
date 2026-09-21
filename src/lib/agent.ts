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
- attendance_summary وstudent_progress للأسئلة عن الحضور والطلاب — لا تخترع أرقاماً أبداً.
- عند فراغ البنك وطلب المعلم أسئلة: استدعِ generate_drafts لتأليف مسودات من المنهج (تُحفظ للمراجعة فقط)، ثم اطلب منه اعتمادها من بنك الأسئلة قبل بناء الامتحان.
- للأسئلة المعرفية (قرارات/كتب/طرق مذاكرة/مناهج): استدعِ search_knowledge أو book_guide أولاً — المعرفة المحلية دقيقة ومجانية.
- لحل مسألة: استدعِ solve_question (من البنك فقط — لا تحل من عندك أبداً).
- لحل امتحان كامل للمراجعة: استدعِ solve_exam.
- لأسئلة «فين/إزاي» عن الداشبورد: استدعِ app_help أولاً.`;

/** اقتراحات متابعة حتمية (بلا تكلفة) حسب آخر أداة ناجحة */
export function followUps(steps: { tool: string; ok: boolean }[]): string[] {
  const last = [...steps].reverse().find((s) => s.ok)?.tool;
  if (last === "create_exam") return ["راجع الامتحان الجديد", "اعمل امتحانًا لمادة أخرى", "عندنا إيه في البنك؟"];
  if (last === "bank_stats") return ["اعمل امتحان من البنك", "اعرض أحدث الامتحانات"];
  if (last === "review_exam") return ["اعرض أحدث الامتحانات", "اعمل امتحانًا جديدًا"];
  if (last === "generate_drafts") return ["اعتمدت المسودات — ابنِ الامتحان", "ألف مسودات لمادة أخرى"];
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
  {
    name: "generate_drafts",
    description: "تأليف مسودات أسئلة جديدة من المنهج عند فراغ البنك: تُحفظ كمسودات للمراجعة البشرية (لا اعتماد تلقائي). استخدمها فقط عندما يطلب المعلم توليد/تأليف أسئلة أو عندما يكون البنك فارغاً.",
    parameters: {
      type: "OBJECT",
      properties: {
        subject: { type: "STRING", description: "المادة" },
        count: { type: "NUMBER", description: "عدد المسودات (1-10، الافتراضي 5)" },
      },
      required: ["subject"],
    },
  },
  {
    name: "search_knowledge",
    description: "البحث في قاعدة معرفة منارة المحلية (قرارات وزارية، أدلة كتب، طرق مذاكرة، نصائح امتحانات) — يعمل دائماً بلا إنترنت ذكي.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "كلمة البحث" },
        kind: { type: "STRING", description: "النوع: ministry_decree, azhar_update, book_guide, teaching_guide, curriculum_note, exam_tip (اختياري)" },
      },
      required: ["query"],
    },
  },
  {
    name: "book_guide",
    description: "ترشيح الكتب الخارجية لمادة وصف (الناشرون وتغطيتهم وملاحظات).",
    parameters: {
      type: "OBJECT",
      properties: {
        subject: { type: "STRING", description: "المادة" },
        grade: { type: "STRING", description: "الصف: ابتدائي/إعدادي/ثانوي (اختياري)" },
        system: { type: "STRING", description: "moe أو azhar (اختياري)" },
      },
      required: ["subject"],
    },
  },
  {
    name: "solve_question",
    description: "حل مسألة: يبحث في البنك عن سؤال مشابه محلول ويعيد إجابته. إن لم يوجد يقول ذلك بصراحة ولا يخمن.",
    parameters: {
      type: "OBJECT",
      properties: { question: { type: "STRING", description: "نص المسألة" } },
      required: ["question"],
    },
  },
  {
    name: "solve_exam",
    description: "حل امتحان كامل للمراجعة: يعرض كل الأسئلة بإجاباتها الصحيحة (للمعلم فقط).",
    parameters: {
      type: "OBJECT",
      properties: { exam_id: { type: "STRING", description: "المعرف (اختياري — الأحدث)" } },
    },
  },
  {
    name: "app_help",
    description: "شرح استخدام المنصة: أين كل صفحة في الداشبورد وكيف تُنجز المهام (حضور/امتحانات/واجبات/دفع/تقارير...).",
    parameters: {
      type: "OBJECT",
      properties: { topic: { type: "STRING", description: "الموضوع (مثال: الحضور، النشر، الواجبات)" } },
      required: ["topic"],
    },
  },
];

export type AgentHistory = { role: "user" | "assistant"; text: string };

/** نسخة مختصرة من التعليمات للنماذج المحلية الصغيرة */
const SYSTEM_SLIM = `أنت مساعد المعلم (عربي مختصر). لديك أدوات: bank_stats, create_exam, list_exams, attendance_summary, student_progress, review_exam, generate_drafts, search_knowledge, book_guide. استدعِ الأداة المناسبة مباشرة. لا تنشر أبداً. لا تخترع أرقاماً.`;

/** تحويل سكيما Gemini (OBJECT/STRING) لصيغة OpenAI (object/string) */
function toOaiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toOaiSchema);
  if (s && typeof s === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
      o[k] = k === "type" && typeof v === "string" ? v.toLowerCase() : toOaiSchema(v);
    }
    return o;
  }
  return s;
}

const SUBJECTS = ["فيزياء", "كيمياء", "أحياء", "رياضيات", "علوم", "عربي", "إنجليزي", "دراسات", "تاريخ", "جغرافيا", "فلسفة", "فرنساوي", "دين"];

function findSubject(m: string): string | null {
  for (const s of SUBJECTS) if (m.includes(s)) return s;
  return null;
}

/**
 * المسار المباشر: أسئلة شائعة تُجاب من الأدوات فوراً بلا أي LLM (فوري + مجاني).
 * يرجع null عندما يحتاج الأمر استدلالاً (إنشاء/تأليف/صياغة حرة).
 */
async function directAnswer(
  admin: any, tid: string, message: string,
  onStep?: (s: { tool: string; ok: boolean }) => void
): Promise<{ text: string; steps: { tool: string; ok: boolean }[] } | null> {
  const m = message;
  const run = async (tool: string, args: Record<string, unknown>) => {
    const { TOOL_IMPLS } = await import("@/mastra/tool-impls");
    const fn = TOOL_IMPLS[tool];
    if (!fn) return null;
    try {
      const out = await fn(admin, tid, args, { keys: [] });
      if ((out as any)?.error) return null;
      const st = { tool, ok: true };
      try { onStep?.(st); } catch {}
      return { text: fallbackSummary({ tool, out }), steps: [st] };
    } catch {
      return null;
    }
  };
  // أسئلة الأنظمة والمناهج والوزارة → المعرفة المحلية مباشرة (تعمل بلا ذكاء)
  if (/بكالوريا|ثانوية|تنسيق|وزارة|أزهر|منهج|نظام التعليم/.test(m)) {
    return run("search_knowledge", { query: m.split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(" ") || m.slice(0, 60) });
  }
  // مساعدة الداشبورد أولاً: صيغة السؤال (فين/إزاي/كيف) تتفوق على الكلمات الموضوعية
  if (/فين|وين|إزاي|ازاي|كيف|شرح|طريقة|داشبورد|لوحة/.test(m)) {
    return run("app_help", { topic: m.slice(0, 100) });
  }
  // أفضل كتاب لمادة → دليل الكتب مباشرة
  if (/كتاب|أفضل|أحسن/.test(m)) {
    const s = findSubject(m);
    if (s) return run("book_guide", { subject: s });
  }
  // محتوى البنك
  if (/البنك|عندك إيه|إيه عندك|كم سؤال|إحصا/.test(m)) {
    return run("bank_stats", { subject: findSubject(m) ?? undefined });
  }
  // الحضور
  if (/حضور|الغياب|غاب|نسبة الحضور/.test(m) && !/طالب/.test(m)) {
    return run("attendance_summary", {});
  }
  // قائمة الامتحانات
  if (/امتحاناتي|اعرض الامتحانات|الامتحانات الموجودة|قائمة الامتحانات/.test(m)) {
    return run("list_exams", {});
  }
  // حل امتحان كامل للمراجعة
  if (/حل الامتحان|حل الاختبار/.test(m)) {
    return run("solve_exam", {});
  }
  // إنشاء امتحان بصيغة مباشرة: "اعمل امتحان <مادة> [من] <عدد> [أسئلة]"
  const mk = m.match(/اعمل|أنشئ|انشئ/);
  if (mk && /امتحان|اختبار/.test(m)) {
    const subj = findSubject(m);
    const numM = m.match(/(\d+)\s*(سؤال|أسئلة|اسئلة)?/);
    if (subj) {
      const out = await (async () => {
        const { TOOL_IMPLS } = await import("@/mastra/tool-impls");
        try {
          const r = await TOOL_IMPLS.create_exam(admin, tid, {
            title: `امتحان ${subj}`, subject: subj, count: numM ? Number(numM[1]) : 5,
          }, { keys: [] });
          if ((r as any)?.error) return null;
          const st = { tool: "create_exam", ok: true };
          try { onStep?.(st); } catch {}
          return { text: fallbackSummary({ tool: "create_exam", out: r }), steps: [st] };
        } catch { return null; }
      })();
      if (out) return out;
    }
  }
  return null;
}

function oaiTools(): unknown[] {
  return DECLARATIONS.map((d: any) => ({
    type: "function",
    function: { name: d.name, description: d.description, parameters: toOaiSchema(d.parameters) },
  }));
}

/** أدوات حسب النية — يقلل التوكنز جذريًا للنماذج المحلية الصغيرة */
function pickTools(message: string): unknown[] {
  const all = oaiTools() as any[];
  const m = message;
  const has = (...words: string[]) => words.some((w) => m.includes(w));
  const want = new Set<string>();
  if (has("امتحان", "اختبار", "بنك", "سؤال", "أسئلة")) { want.add("bank_stats"); want.add("create_exam"); want.add("list_exams"); want.add("generate_drafts"); }
  if (has("راجع", "تدقيق", "دقق")) want.add("review_exam");
  if (has("حضور", "غائب", "غاب")) want.add("attendance_summary");
  if (has("طالب", "طالبة", "مستوى", "نقاط", "درجة")) want.add("student_progress");
  if (has("كتاب", "قرار", "وزارة", "منهج", "أزهر", "مذاكرة", "أخبار", "جديد", "بكالوريا", "ثانوية", "تنسيق", "نظام التعليم")) { want.add("search_knowledge"); want.add("book_guide"); }
  if (has("حل", "مسألة", "إجابة", "جواب")) want.add("solve_question");
  if (has("فين", "وين", "إزاي", "ازاي", "كيف", "داشبورد", "لوحة", "شرح", "طريقة")) want.add("app_help");
  if (!want.size) return all; // غير واضح — كل الأدوات
  return all.filter((t) => want.has(t.function.name));
}

/**
 * حلقة ReAct عبر أي endpoint متوافق مع OpenAI (نموذج مستضاف ذاتياً: vLLM/Ollama).
 * يُفعَّل بـ AGENT_LLM_URL (+ AGENT_LLM_MODEL + AGENT_LLM_KEY اختياري) — الاستقلال الكامل عن Gemini.
 */
async function openaiLoop(
  admin: any, tid: string, history: AgentHistory[], keys: string[],
  onStep?: (s: { tool: string; ok: boolean }) => void,
  override?: { base: string; model: string; key?: string }
): Promise<{ text: string; steps: { tool: string; ok: boolean }[] } | null> {
  const base = ((override?.base ?? process.env.AGENT_LLM_URL ?? "").replace(/\/$/, ""));
  if (!base && !override) return null;
  const model = override?.model ?? process.env.AGENT_LLM_MODEL ?? "qwen3-8b";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const hk = override?.key ?? process.env.AGENT_LLM_KEY;
  if (hk) headers.Authorization = "Bearer " + hk;
  const timeoutMs = Number(process.env.AGENT_LLM_TIMEOUT_MS ?? 90000) || 90000;
  const userText = history.filter((h) => h.role === "user").map((h) => h.text).join(" ").slice(-500);
  const tools = pickTools(userText);
  // النماذج المحلية الصغيرة: سياق مخفف (أسرع بكثير على CPU)
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  const messages: any[] = [
    { role: "system", content: isLocal ? SYSTEM_SLIM : SYSTEM },
    ...(isLocal ? history.slice(-2).map((h) => ({ role: h.role, content: h.text.slice(0, 400) })) : history.slice(-6).map((h) => ({ role: h.role, content: h.text.slice(0, 1000) }))),
  ];
  const steps: { tool: string; ok: boolean }[] = [];
  let lastResult: { tool: string; out: unknown } | null = null;
  for (let s = 0; s < MAX_STEPS; s++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let j: any = null;
    try {
      const r = await fetch(base + "/chat/completions", {
        method: "POST", headers, signal: ctrl.signal,
        body: JSON.stringify({ model, messages, tools, tool_choice: "auto", temperature: 0.3, max_tokens: 800 }),
      });
      j = await r.json().catch(() => null);
      if (!r.ok) return null; // فشل النقطة — السقوط لـ Gemini
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
    const msg = j?.choices?.[0]?.message;
    if (!msg) return null;
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!calls.length) return { text: String(msg.content ?? "").trim() || "لم أفهم — أعد الصياغة.", steps };
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls.map((c: any) => ({ id: c.id, type: "function", function: c.function })) });
    for (const c of calls) {
      const name = String(c?.function?.name ?? "");
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(String(c?.function?.arguments ?? "{}")) || {}; } catch {}
      const out = await execTool(admin, tid, name, args, keys);
      const ok = !(out as any)?.error;
      const st = { tool: name, ok };
      steps.push(st);
      try { onStep?.(st); } catch {}
      lastResult = { tool: name, out };
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out).slice(0, 4000) });
    }
  }
  void lastResult;
  return { text: "نفذت الخطوات لكن المهمة تحتاج تبسيطاً.", steps };
}

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

async function execTool(
  admin: any, tid: string, name: string, args: Record<string, unknown>, keys: string[]
): Promise<unknown> {
  const { TOOL_IMPLS } = await import("@/mastra/tool-impls");
  const fn = TOOL_IMPLS[name];
  if (!fn) return { error: "unknown_tool" };
  try {
    return await fn(admin, tid, args, { keys });
  } catch {
    return { error: "tool_failed" };
  }
}

/** صياغة حرة لنتيجة أداة عبر Pollinations المجاني (نص فقط — بلا أدوات) */
async function phraseWithPollinations(tool: string, out: unknown): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: "أنت مساعد المعلم في منارة. صغ النتيجة التالية ردًا عربيًا مختصرًا مفيدًا (3 أسطر حد أقصى)." },
          { role: "user", content: `الأداة: ${tool}\nالنتيجة: ${JSON.stringify(out).slice(0, 2000)}` },
        ],
        max_tokens: 400,
      }),
    }).finally(() => clearTimeout(timer));
    const j = await r.json().catch(() => null);
    const t = String(j?.choices?.[0]?.message?.content ?? "").trim();
    return t.length >= 5 ? t.slice(0, 1000) : null;
  } catch {
    return null;
  }
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
  if (last?.tool === "generate_drafts" && typeof o.drafts === "number") {
    return `ألفت ${o.drafts} مسودات ${o.subject ? `لمادة «${o.subject}»` : ""}${o.with_answers ? " (معظمها بإجابات)" : ""} — راجعها واعتمدها من بنك الأسئلة، ثم اطلب مني بناء الامتحان.`;
  }
  if (last?.tool === "generate_drafts" && o.error) {
    return "تعذر تأليف الأسئلة حالياً — امسح ورقة بالكاميرا من بنك الأسئلة كبديل.";
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
  if (last?.tool === "search_knowledge" && Array.isArray(o)) {
    if (!o.length) return "لا نتائج في قاعدة المعرفة لهذا الموضوع — جرّب كلمات أخرى أو اسأل عن البنك والامتحانات.";
    return "من قاعدة المعرفة:\n" + o.slice(0, 4).map((r: any) => `• ${r.title}: ${String(r.body).slice(0, 160)}`).join("\n");
  }
  if (last?.tool === "book_guide" && Array.isArray(o.books)) {
    if (!o.books.length) return `لا كتب مسجلة لمادة «${o.subject}» — اسأل عن مادة أخرى.`;
    return `أفضل الكتب لمادة «${o.subject}»:\n` + o.books.slice(0, 5).map((b: any) => `• ${b.publisher}${b.notes ? ` — ${b.notes}` : ""}`).join("\n");
  }
  if (last?.tool === "attendance_summary" && typeof o.records === "number") {
    if (!o.records) return "لا سجلات حضور آخر 7 أيام.";
    return `الحضور آخر 7 أيام: ${o.present} حاضر من ${o.records} (نسبة ${o.rate ?? 0}%).`;
  }
  if (last?.tool === "student_progress" && o.name) {
    const ex = ((o.last_exams ?? []) as any[]).slice(0, 3).map((e: any) => `${e.title} ${e.score}/${e.total}`).join("، ");
    return `${o.name}: ${o.points} نقطة، ${o.homework_graded} واجبات مصححة${ex ? "، آخر الامتحانات: " + ex : ""}.`;
  }
  if (last?.tool === "review_exam" && typeof o.total === "number") {
    if (o.clean) return `الامتحان سليم (${o.total} أسئلة) — جاهز للنشر.`;
    return `مراجعة الامتحان (${o.total} أسئلة): ` + ((o.issues ?? []) as string[]).slice(0, 5).join("؛ ");
  }
  if (last?.tool === "solve_question" && o.answer) {
    const opts = Array.isArray(o.options) ? `\nالاختيارات: ${o.options.join("، ")}` : "";
    return `وجدت سؤالاً مشابهاً في بنكك (${o.subject ?? ""}): «${String(o.matched).slice(0, 150)}»${opts}\nالإجابة الصحيحة: ${o.answer}`;
  }
  if (last?.tool === "solve_question" && o.error) {
    return "لا يوجد سؤال مشابه محلول في بنكك — أضف السؤال أولاً أو اطلب تأليف مسودات.";
  }
  if (last?.tool === "solve_exam" && typeof o.total === "number") {
    return `حل الامتحان (${o.total} أسئلة):\n` + ((o.solved ?? []) as any[]).slice(0, 10).map((s: any) => `${s.n}) ${String(s.q).slice(0, 80)} ← ${s.answer ?? "؟"}`).join("\n");
  }
  if (last?.tool === "app_help" && Array.isArray(o.answers)) {
    return o.answers.slice(0, 3).join("\n\n");
  }
  return "تعذر الوصول لخدمة الذكاء حالياً (ازدحام) — حاول بعد قليل.";
}

export async function runAgent(
  admin: any, tid: string, history: AgentHistory[], tenantKey?: string | null, tenantKey2?: string | null,
  onStep?: (s: { tool: string; ok: boolean }) => void
): Promise<{ text: string; steps: { tool: string; ok: boolean }[] }> {
  const keys = visionChain(tenantKey, tenantKey2);
  // 0) المسار المباشر الحتمي أولاً: فوري ومجاني وبلا أخطاء هلوسة
  try {
    const direct = await directAnswer(admin, tid, history.filter((h) => h.role === "user").map((h) => h.text).join(" ").slice(-500), onStep);
    if (direct) return direct;
  } catch {}
  // 1) المستضاف ذاتياً (vLLM/Ollama) إن ضُبط — الاستقلال أولاً
  if (process.env.AGENT_LLM_URL) {
    const selfHosted = await openaiLoop(admin, tid, history, keys, onStep);
    if (selfHosted) return selfHosted;
  }
  if (!keys.length && !process.env.AGENT_LLM_URL) return { text: "لا يوجد مفتاح ذكاء — اربط مفتاح Gemini من الإعدادات أو اضبط AGENT_LLM_URL.", steps: [] };
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
      // صياغة مجانية أولاً (Pollinations نص فقط)، ثم العرض الحتمي المضمون
      if (lastResult) {
        const phrased = await phraseWithPollinations(lastResult.tool, lastResult.out);
        if (phrased) return { text: phrased, steps };
      }
      return { text: fallbackSummary(lastResult), steps };
    }
    if (!res.call) return { text: res.text || "لم أفهم — أعد الصياغة.", steps };
    // تنفيذ الأداة وإرجاع نتيجتها للحلقة
    let out: unknown;
    try {
      out = await execTool(admin, tid, res.call.name, res.call.args, keys);
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
