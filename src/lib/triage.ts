/** تصنيف قاعدي للشكاوى: فئة + أولوية (يُستخدم عند الإنشاء) */
export function triageComplaint(body: string, kind: string): { category: string; priority: "normal" | "high" } {
  if (kind === "suggestion") return { category: "suggestion", priority: "normal" };
  const t = body;
  const has = (ws: string[]) => ws.some((w) => t.includes(w));
  let category = "general";
  if (has(["مصاريف", "فلوس", "فاتورة", "دفع", "قسط", "مبلغ"])) category = "billing";
  else if (has(["غياب", "حضور", "تأخير", "حصة"])) category = "attendance";
  else if (has(["امتحان", "درجة", "تصحيح", "نتيجة"])) category = "exams";
  else if (has(["مدرس", "شرح", "معلم", "أستاذ"])) category = "teaching";
  const priority = has(["ظلم", "سرقة", "ضرب", "إهانة", "تحرش", "نصب", "عاجل"])
    || (category === "billing" && has(["غلط", "زيادة", "ضعف"])) ? "high" : "normal";
  return { category, priority };
}

export const CATEGORY_LABEL: Record<string, string> = {
  general: "عام", billing: "مصاريف", attendance: "حضور", exams: "امتحانات", teaching: "تدريس", suggestion: "اقتراح",
};
