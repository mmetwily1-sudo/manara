/**
 * نسخ الرؤية (Gemini) — أعلى جودة مسودات للعربية والمعادلات.
 * تُفعَّل بمفتاح مجاني من aistudio.google.com في GEMINI_API_KEY.
 * بدون مفتاح: isVisionLive()=false ويكمل النظام بـ Tesseract/اليدوي.
 * المراجعة البشرية تبقى إلزامية دائماً — الرؤية مساعد لا حَكَم.
 */

export function envVisionKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || null;
}

/** مفتاح السنتر أولاً (من إعداداته)، ثم مفتاح المنصة */
export function visionKey(tenantKey?: string | null): string | null {
  const t = String(tenantKey ?? "").trim();
  if (t.length >= 10) return t;
  return envVisionKey();
}

export function isVisionLive(tenantKey?: string | null): boolean {
  return !!visionKey(tenantKey);
}

export type VisionSegment = { text: string };

const PROMPT =
  "You transcribe Arabic exam paper photos into structured drafts. " +
  "Read the image carefully (Arabic RTL, ignore decorative watermarks/headers/footers). " +
  "Split into individual questions. For each: full question text, then options each on its own line " +
  "starting with the original marker like أ) or 1). " +
  "Return ONLY a JSON array, no markdown, no explanation: " +
  '[{"text": "question line\\nأ) opt1\\nb) opt2"}]. ' +
  "If a page has no questions, return []. Keep Quranic verses and formulas as-is.";

export async function transcribeImage(
  buf: Buffer,
  mime: string,
  timeoutMs = 60000,
  tenantKey?: string | null
): Promise<{ ok: true; segments: VisionSegment[] } | { ok: false; reason: string }> {
  const key = visionKey(tenantKey);
  if (!key) return { ok: false, reason: "not_configured" };
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mime, data: buf.toString("base64") } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
        }),
      }
    );
    const j = await r.json().catch(() => null);
    const text: string =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    if (!r.ok || !text) {
      return { ok: false, reason: "api_error:" + String(j?.error?.message ?? r.status).slice(0, 80) };
    }
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start < 0 || end <= start) return { ok: false, reason: "bad_shape" };
    const arr = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(arr)) return { ok: false, reason: "bad_shape" };
    const segments = arr
      .map((x: any) => String(x?.text ?? "").trim())
      .filter((s: string) => s.length >= 10)
      .map((s: string) => ({ text: s.slice(0, 2000) }));
    return { ok: true, segments };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return { ok: false, reason: msg.toLowerCase().includes("abort") ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
