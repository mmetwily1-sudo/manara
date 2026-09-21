import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildManaraTools } from "./tools";

const SYSTEM = `أنت مساعد المعلم في منصة منارة (عربي، مختصر، عملي).
لديك أدوات حقيقية لبنك الأسئلة والامتحانات — استخدمها بدل التخمين.
قواعد صارمة:
- إذا طلب امتحاناً مباشرة استدعِ create_exam فوراً دون إحصاء مسبق.
- بعد كل إنشاء راجعه بـ review_exam قبل تسليم الإجابة.
- لا تنشر أي امتحان أبداً — أنشئه غير منشور واذكر مراجعته ونشره يدوياً.
- لا تخترع أسئلة أو أرقاماً — ابنِ من البنك فقط، وإن كان فارغاً قل ذلك بوضوح مع البديل.
- attendance_summary وstudent_progress للأسئلة عن الحضور والطلاب.
- عند فراغ البنك وطلب المعلم أسئلة: استدعِ generate_drafts لتأليف مسودات من المنهج (تُحفظ للمراجعة فقط)، ثم اطلب منه اعتمادها من بنك الأسئلة قبل بناء الامتحان.
- للأسئلة المعرفية (قرارات/كتب/طرق مذاكرة/مناهج): استدعِ search_knowledge أو book_guide أولاً.
- لحل مسألة: solve_question من البنك فقط (لا تحل من عندك).
- لحل امتحان كامل: solve_exam. ولأسئلة الداشبورد: app_help أولاً.
- أجب بالعربية الفصحى المبسطة بجمل قصيرة، واذكر ما فعلته بأدواتك.`;

let storeInit: Promise<unknown> | null = null;
function sharedStore() {
  const store = new PostgresStore({
    id: "manara-mastra-store",
    connectionString: process.env.DATABASE_URL!,
  });
  if (!storeInit) storeInit = store.init().catch(() => null);
  return store;
}

const memory = new Memory({
  storage: sharedStore(),
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      scope: "resource",
      template: `# ملف المعلم\n- السنتر:\n- المواد التي يدرسها:\n- ملاحظات دائمة:\n`,
    },
  },
});

/**
 * وكيل Mastra مربوط بمفتاح المستأجر (rotation خارجي) وسياق السنتر.
 * الذاكرة: Postgres (جداول Mastra) بمفتاح thread = محادثتنا وresource = السنتر:المستخدم.
 */
export function getManaraAgent(apiKey: string, admin: any, tid: string, keys: string[] = []) {
  const google = createGoogleGenerativeAI({ apiKey });
  // cast مقصود: توافق إصدارات AI SDK بين مزود Google وMastra — أي عطل يسقط للمسار الاحتياطي
  const model = google("gemini-flash-latest") as any;
  return new Agent({
    id: "manara-teacher-agent",
    name: "مساعد منارة",
    instructions: SYSTEM,
    model,
    tools: buildManaraTools(admin, tid, keys.length ? keys : [apiKey]),
    memory,
  });
}
