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

const OPT_LINE =
  /^\s*(?:\(?[أ-ي]\)|\(?[a-dA-D]\)|\(?\d+\)|[أ-ي]\.|[a-dA-D]\.|\d+\.)\s*\S/;

/**
 * فصل سؤال عن اختياراته: آخر كتلة متصلة من سطور تبدأ بعلامات
 * (أ) ب) ج) د) / 1) 2) / أ. ب. ...) تُقتطع كاختيارات، والباقي متن السؤال.
 * يُستخدم عند إنشاء المسودات لتصل المراجع باختيارات جاهزة.
 */
export function splitQuestion(text: string): { stem: string; options: string[] } {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { stem: String(text ?? "").trim(), options: [] };
  let cut = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (OPT_LINE.test(lines[i])) cut = i;
    else if (cut >= 0) break;
  }
  if (cut <= 0) return { stem: String(text ?? "").trim(), options: [] };
  const options = dedupe(lines.slice(cut).map(stripMarker).filter((s) => s.length > 0));
  const stem = lines.slice(0, cut).join("\n").trim();
  if (stem && options.length >= 2) return { stem, options };
  // بديل الشرطات في سطر واحد: "س؟\nأ - ب - ج"
  if (lines.length >= 2) {
    const last = lines[lines.length - 1];
    const dashed = last.split(/\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
    if (dashed.length >= 2) {
      return { stem: lines.slice(0, -1).join("\n").trim(), options: dedupe(dashed) };
    }
  }
  return { stem: String(text ?? "").trim(), options: [] };
}
