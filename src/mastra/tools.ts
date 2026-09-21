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
      execute: async ({ context }: any) => {
        try {
          return await run((context ?? {}) as Record<string, unknown>);
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
  };
}
