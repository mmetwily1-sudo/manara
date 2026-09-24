import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { TOOL_IMPLS } from "./tool-impls";

/**
 * أدوات وكيل منارة بصيغة Mastra (Zod) — نفس التنفيذ في tool-impls.
 * تُبنى لكل طلب مع سياق السنتر (admin, tid) المربوط بالـ closure.
 */
export function buildManaraTools(admin: any, tid: string, keys: string[] = []) {
  const wrap = (
    id: string, description: string, schema: z.ZodTypeAny,
    run: (args: Record<string, unknown>) => Promise<unknown>
  ) =>
    createTool({
      id,
      description,
      inputSchema: schema,
      // Mastra v1: execute(inputData, context) — الوسيط الأول هو مُدخلات الأداة نفسها
      execute: async (inputData: any, context: any) => {
        try {
          try { console.error(`[tool:${id}] input=`, JSON.stringify(inputData ?? null).slice(0, 300)); } catch {}
          const args = (inputData && typeof inputData === "object" && !Array.isArray(inputData) ? inputData : {}) as Record<string, unknown>;
          return await run(args);
        } catch {
          return { error: "tool_failed" };
        }
      },
    });

  return {
    bank_stats: wrap(
      "bank_stats",
      "إحصاء بنك الأسئلة المعتمدة حسب المادة. استخدمها عند السؤال عن محتوى البنك.",
      z.object({ subject: z.string().optional().describe("المادة للفلترة") }),
      (args) => TOOL_IMPLS.bank_stats(admin, tid, args)
    ),
    create_exam: wrap(
      "create_exam",
      "إنشاء امتحان غير منشور من البنك وربط أسئلته. لا تنشر أبداً.",
      z.object({
        title: z.string().describe("عنوان الامتحان"),
        subject: z.string().optional().describe("المادة"),
        count: z.number().min(1).max(50).optional().describe("عدد الأسئلة (افتراضي 5)"),
      }),
      (args) => TOOL_IMPLS.create_exam(admin, tid, args)
    ),
    list_exams: wrap(
      "list_exams",
      "أحدث الامتحانات: العنوان وعدد الأسئلة وحالة النشر.",
      z.object({}),
      (args) => TOOL_IMPLS.list_exams(admin, tid, args)
    ),
    attendance_summary: wrap(
      "attendance_summary",
      "ملخص الحضور آخر 7 أيام: المسجلون ونسبة الحضور.",
      z.object({}),
      (args) => TOOL_IMPLS.attendance_summary(admin, tid, args)
    ),
    student_progress: wrap(
      "student_progress",
      "نبذة طالب بالاسم: نقاطه وواجباته وآخر نتائجه.",
      z.object({ name: z.string().describe("اسم الطالب") }),
      (args) => TOOL_IMPLS.student_progress(admin, tid, args)
    ),
    review_exam: wrap(
      "review_exam",
      "مراجعة امتحان (مدقق ثانٍ): نص ناقص/خيارات/إجابة/تكرار. راجعه بعد كل إنشاء.",
      z.object({ exam_id: z.string().optional().describe("المعرف — الأحدث إن ترك فارغاً") }),
      (args) => TOOL_IMPLS.review_exam(admin, tid, args)
    ),
    generate_drafts: wrap(
      "generate_drafts",
      "تأليف مسودات أسئلة جديدة من المنهج عند فراغ البنك (تُحفظ للمراجعة البشرية فقط).",
      z.object({
        subject: z.string().describe("المادة"),
        count: z.number().min(1).max(10).optional().describe("العدد (افتراضي 5)"),
      }),
      (args) => TOOL_IMPLS.generate_drafts(admin, tid, args, { keys })
    ),
    search_knowledge: wrap(
      "search_knowledge",
      "البحث في قاعدة معرفة منارة المحلية (قرارات/كتب/مذاكرة/مناهج) — يعمل دائماً.",
      z.object({
        query: z.string().describe("كلمة البحث"),
        kind: z.string().optional().describe("النوع (اختياري)"),
      }),
      (args) => TOOL_IMPLS.search_knowledge(admin, tid, args)
    ),
    book_guide: wrap(
      "book_guide",
      "ترشيح الكتب الخارجية لمادة وصف.",
      z.object({
        subject: z.string().describe("المادة"),
        grade: z.string().optional().describe("الصف"),
        system: z.string().optional().describe("moe أو azhar"),
      }),
      (args) => TOOL_IMPLS.book_guide(admin, tid, args)
    ),
    curriculum_outline: wrap(
      "curriculum_outline",
      "مخطط منهج مادة: الوحدات والدروس من قاعدة المناهج.",
      z.object({ subject: z.string().describe("المادة") }),
      (args) => TOOL_IMPLS.curriculum_outline(admin, tid, args)
    ),
    solve_question: wrap(
      "solve_question",
      "حل مسألة من البنك (بحث عن مشابه محلول — لا تخمين).",
      z.object({ question: z.string().describe("نص المسألة") }),
      (args) => TOOL_IMPLS.solve_question(admin, tid, args)
    ),
    solve_exam: wrap(
      "solve_exam",
      "حل امتحان كامل للمراجعة (أسئلة بإجاباتها).",
      z.object({ exam_id: z.string().optional().describe("المعرف — الأحدث") }),
      (args) => TOOL_IMPLS.solve_exam(admin, tid, args)
    ),
    app_help: wrap(
      "app_help",
      "شرح استخدام المنصة والداشبورد.",
      z.object({ topic: z.string().describe("الموضوع") }),
      (args) => TOOL_IMPLS.app_help(admin, tid, args)
    ),
  };
}
