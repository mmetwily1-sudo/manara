/**
 * اقتراح الدرس الحتمي (بدون ذكاء اصطناعي — قابل للتدقيق 100%).
 * يطبّع النص العربي، يستخرج الكلمات الدالة، ويحسب تداخلها مع عناوين
 * الوحدة/الدرس. يُرجع أفضل 3 مع الكلمات المشتركة كدليل للمراجع البشري.
 * القرار النهائي دائماً بشري (زر تأكيد).
 */

const STOP = new Set(
  "في من على إلى ما هل التي الذي الذين وما ولم وهل وقد إن أن كان كانت يكون تكون يوجد توجد يتم كل بعض غير بين مع عن أو أم ثم أوضح علل قارن اذكر ما ما هو هي هم نحن هذا هذه ذلك تلك أول ثان ثالث يلي يأتي التالي سؤال اختر الإجابة الصحيحة مما يأتي علامة صح خطأ أمام العبارة".split(" ")
);

export function normalizeAr(s: string): string {
  return String(s ?? "")
    .replace(/[ً-ٰٟ]/g, "") // تشكيل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^ء-غف-يa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function keywords(s: string): string[] {
  return normalizeAr(s)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

export type LessonRef = { code: string; lesson_title: string; unit_title: string };
export type Suggestion = { code: string; lesson_title: string; unit_title: string; score: number; matched: string[] };

/** رتّب دروس (مسار+مادة) حسب الصلة بنص السؤال */
export function suggestLessons(questionText: string, lessons: LessonRef[], top = 3): Suggestion[] {
  const qset = new Set(keywords(questionText));
  if (!qset.size) return [];
  const scored: Suggestion[] = [];
  for (const l of lessons) {
    const lt = new Set(keywords(l.lesson_title + " " + l.unit_title));
    const matched = Array.from(lt).filter((w) => qset.has(w));
    // وزن: تطابق عنوان الدرس ×2 (بتكرار كلماته)، ثم الوحدة
    const lessonWords = new Set(keywords(l.lesson_title));
    let score = 0;
    for (const w of matched) score += lessonWords.has(w) ? 2 : 1;
    if (score > 0) scored.push({ ...l, score, matched });
  }
  scored.sort((a, b) => b.score - a.score || a.lesson_title.localeCompare(b.lesson_title, "ar"));
  return scored.slice(0, top);
}
