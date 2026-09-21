/**
 * بذرة قاعدة المعرفة: كتالوج كتب خارجية + مذكرات تأسيسية.
 * التشغيل: node scripts/seed-knowledge.mjs (مرة واحدة — يتخطى إن وُجدت بيانات).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const req = createRequire(process.cwd() + "/");
const { createClient } = await import("@supabase/supabase-js");
function env(n) {
  const raw = readFileSync(".env.local", "utf8");
  return (raw.match(new RegExp("^" + n + "=(.+)$", "m")) || [])[1]?.trim();
}
const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const { count: bc } = await admin.from("external_books").select("id", { count: "exact", head: true });
if ((bc ?? 0) > 0) {
  console.log("books already seeded:", bc);
} else {
  const pubs = [
    ["سلاح التلميذ", ["عربي", "رياضيات", "علوم", "دراسات", "إنجليزي"], ["ابتدائي", "إعدادي"], "الأشمل للابتدائي — شرح + تدريبات متدرجة."],
    ["الامتحان", ["فيزياء", "كيمياء", "أحياء", "رياضيات", "عربي", "إنجليزي"], ["إعدادي", "ثانوي"], "الأقوى للثانوية — بنك أسئلة ضخم ونماذج امتحانات."],
    ["المعاصر", ["إنجليزي", "Math", "Science"], ["ابتدائي", "إعدادي", "ثانوي"], "الأول للغات — نسخ عربي ولغات متوازية."],
    ["الأضواء", ["عربي", "دراسات", "علوم", "رياضيات"], ["ابتدائي", "إعدادي"], "تبسيط ممتاز + خرائط ذهنية."],
    ["قطر الندى", ["عربي", "رياضيات", "علوم", "دراسات"], ["ابتدائي"], "تأسيس قوي للصفوف الأولى."],
    ["بكار", ["عربي", "رياضيات"], ["ابتدائي"], "تدريبات مكثفة وأسعار مناسبة."],
    ["Gem", ["إنجليزي"], ["إعدادي", "ثانوي"], "جرامر وكلمات بتركيز امتحاني."],
    ["Bit by Bit", ["إنجليزي"], ["ابتدائي", "إعدادي"], "تأسيس لغة تدريجي."],
    ["برافو", ["فرنساوي"], ["إعدادي", "ثانوي"], "الخيار الشائع للغة الثانية فرنساوي."],
    ["التميز", ["شرعي", "عربي"], ["إعدادي", "ثانوي"], "مواد الأزهر الشرعية والعربية."],
  ];
  const rows = [];
  for (const [pub, subjects, grades, note] of pubs) {
    for (const s of subjects) for (const g of grades) {
      rows.push({ publisher: pub, subject: s, grade: g, system: "moe", notes: note });
    }
  }
  // نسخ أزهر للأساسيات
  for (const s of ["عربي", "رياضيات", "علوم"]) {
    rows.push({ publisher: "سلاح التلميذ", subject: s, grade: "إعدادي", system: "azhar", notes: "صالح لمعاهد الأزهر مع مراعاة فروق المنهج." });
  }
  const { error } = await admin.from("external_books").insert(rows);
  console.log("books:", error ? "ERR " + error.message : "OK " + rows.length);
}

const { count: kc } = await admin.from("edu_knowledge").select("id", { count: "exact", head: true });
if ((kc ?? 0) > 0) {
  console.log("knowledge already seeded:", kc);
} else {
  const rows = [
    { kind: "teaching_guide", system: "general", title: "كيف تذاكر الفيزياء للثانوية", body: "افهم القانون قبل حفظه: اشتقاق سريع + وحدة قياس + مثال عددي. حل مسائل الكتاب المدرسي أولاً ثم كتاب الامتحان. راجع الأخطاء في كشكول منفصل.", source_url: null },
    { kind: "teaching_guide", system: "general", title: "خطة مراجعة ليلة الامتحان", body: "قسّم المادة لوحدات، ابدأ بالأعلى وزنًا في الامتحانات السابقة، حل نموذجين كاملين بتوقيت حقيقي، نم جيدًا — السهر يخفض التركيز.", source_url: null },
    { kind: "exam_tip", system: "general", title: "تظليل البابل شيت صحيحًا", body: "ظلل الدائرة كاملة بقلم رصاص داكن، لا تخرج عن الحدود، وإن أخطأت امسح تمامًا. راجع رقم السؤال قبل كل تظليل.", source_url: null },
    { kind: "exam_tip", system: "general", title: "إدارة وقت الامتحان", body: "مرر سريعًا وحدد الصعب، ابدأ بالسهل المضمون، اترك 15 دقيقة أخيرة للمراجعة والنقل لورقة الإجابة.", source_url: null },
    { kind: "book_guide", system: "general", title: "كيف تختار كتابًا خارجيًا", body: "ابتدائي: سلاح التلميذ أو الأضواء للتأسيس. إعدادي: الامتحان للمواد العلمية. ثانوية: الامتحان + المعاصر للغات. قارن طبعة السنة الحالية مع منهج الوزارة.", source_url: null },
    { kind: "curriculum_note", system: "moe", title: "مسارات الثانوية العامة", body: "شعبة علمي علوم (أحياء + كيمياء + فيزياء)، علمي رياضة (رياضيات + فيزياء + كيمياء)، أدبي (تاريخ + جغرافيا + فلسفة + لغات). اختر الكتب الخارجية حسب شعبتك.", source_url: "https://moe.gov.eg/" },
    { kind: "curriculum_note", system: "azhar", title: "مواد الأزهر الإضافية", body: "بجانب مواد التربية والتعليم: قرآن كريم، فقه، توحيد وتفسير، نحو وصرف وبلاغة. كتب التراث (التميز/المرشد) تغطي الشرعي والعربي.", source_url: "https://www.azhar.eg/" },
    { kind: "ministry_decree", system: "moe", title: "الكتب الدراسية الرسمية 2026-2027", body: "الكتب الرسمية متاحة مجانًا في المكتبة الإلكترونية للوزارة. اعتمد عليها كمصدر أول ثم الكتب الخارجية للتدريب.", source_url: "https://studentbooks.moe.gov.eg/" },
  ];
  const { error } = await admin.from("edu_knowledge").insert(rows);
  console.log("knowledge:", error ? "ERR " + error.message : "OK " + rows.length);
}
