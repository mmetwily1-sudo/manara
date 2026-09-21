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
- عند فراغ البنك وطلب المعلم أسئلة: استدعِ generate_drafts لتأليف مسودات من المنهج (تُحفظ للمراجعة فقط)، ثم اطلب منه اعتمادها من بنك الأسئلة قبل بناء الامتحان.`;

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
