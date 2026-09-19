/**
 * تحليل نص الاختيارات بأي صيغة شائعة إلى مصفوفة نظيفة:
 * - سطر لكل اختيار (الأساسية)
 * - سطر واحد بفواصل مرقّمة: أ) .. ب) .. / 1) .. 2) .. / أ. .. ب. .. / (أ) .. (ب)
 * - شرطات: .. - .. - ..
 * تُجرَّد علامات الترقيم البادئة، وتُرفض الفارغة والمكررة.
 */

const MARKER =
  /(?:^|\s)(?:\(?[أ-ي]\)|\(?[a-dA-D]\)|\(?\d+\)|[أ-ي]\.|[a-dA-D]\.|[أ-ي]-|\d+-)\s*/;

function stripMarker(s: string): string {
  return s
    .replace(/^\s*\(?[أ-ي]\)\s*/, "")
    .replace(/^\s*\(?[a-dA-D]\)\s*/, "")
    .replace(/^\s*\(?\d+\)\s*/, "")
    .replace(/^\s*[أ-ي]\.\s*/, "")
    .replace(/^\s*[a-dA-D]\.\s*/, "")
    .replace(/^\s*[أ-ي]-\s*/, "")
    .replace(/^\s*\d+-\s*/, "")
    .replace(/^\s*[-–—•]\s*/, "")
    .trim();
}

export function parseOptions(input: unknown): string[] {
  const lines = Array.isArray(input)
    ? input.map((x) => String(x ?? ""))
    : String(input ?? "").split(/\r?\n/);
  const clean = lines.map((l) => stripMarker(l)).filter((s) => s.length > 0);
  if (clean.length >= 2) return dedupe(clean);
  // سطر واحد؟ جرّب التقسيم بالعلامات
  const single = (Array.isArray(input) ? input.join(" ") : String(input ?? "")).trim();
  if (!single) return [];
  const parts = single
    .split(MARKER)
    .map((s) => stripMarker(s))
    .filter((s) => s.length > 0);
  if (parts.length >= 2) return dedupe(parts);
  // شرطات أخيرة
  const dashed = single.split(/\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
  if (dashed.length >= 2) return dedupe(dashed);
  return clean.length ? clean : [];
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.replace(/\s+/g, " ");
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}
