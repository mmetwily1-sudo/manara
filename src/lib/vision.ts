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

/** سلسلة المفاتيح بالترتيب — تُجرَّب عند نفاد الحصة.
 * أضف مفاتيح AI Studio مجانية (حسابات جوجل متعددة) عبر GEMINI_API_KEY_3/4/5 لمضاعفة الحصة مجاناً. */
export function visionChain(tenantKey?: string | null, tenantKey2?: string | null): string[] {
  const list = [
    tenantKey,
    tenantKey2,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_AI_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ]
    .map((k) => String(k ?? "").trim())
    .filter((k) => k.length >= 10);
  return Array.from(new Set(list));
}

export function isVisionLive(tenantKey?: string | null, tenantKey2?: string | null): boolean {
  return visionChain(tenantKey, tenantKey2).length > 0;
}

export type VisionSegment = { text: string; answer?: string | null };

const PROMPT =
  "You transcribe Arabic exam paper photos into structured drafts. " +
  "Read the image carefully (Arabic RTL, ignore decorative watermarks/headers/footers). " +
  "Split into individual questions. For each: full question text, then options each on its own line " +
  "starting with the original marker like أ) or 1). " +
  "Then SOLVE each question yourself (you are an expert Egyptian curriculum teacher) and add the " +
  "correct option as exact text copied from the options. " +
  "Return ONLY a JSON array, no markdown, no explanation: " +
  '[{"text": "question line\\nأ) opt1\\nb) opt2", "answer": "opt2 exact text"}]. ' +
  "If a page has no questions, return []. Keep Quranic verses and formulas as-is.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** توحيد نص الخيار للمقارنة (تجريد علامات أ) 1) - ... البادئة) */
export function normOption(t: string): string {
  return String(t ?? "")
    .replace(/^[\sأبجدهـو\d]+[).:\-]/, "")
    .replace(/^[\(\[]\s*[أبجدهـوa-dA-D\d]\s*[\)\]]\s*/, "")
    .trim();
}

/**
 * حل سؤال من خياراته (مكالمة نصية واحدة رخيصة).
 * يعيد الخيار المطابق حرفياً أو null — لا تخمين أبداً.
 */
export async function solveAnswer(
  stem: string, options: string[], keys: string[]
): Promise<string | null> {
  if (!keys.length || options.length < 2) return null;
  const prompt =
    "You are an expert Egyptian curriculum teacher. Answer this multiple-choice question. "
    + "Return ONLY the exact text of the correct option, copied word-for-word, nothing else. "
    + "Question: " + String(stem).slice(0, 500) + "\nOptions:\n"
    + options.slice(0, 6).map((o, i) => `${i + 1}) ${o}`).join("\n");
  for (const key of keys) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + key,
        {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 200 },
          }),
        }
      ).finally(() => clearTimeout(timer));
      const j = await r.json().catch(() => null);
      const t: string = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("").trim() ?? "";
      if (r.ok && t) {
        const m = options.find((o) => o === t || normOption(o) === normOption(t));
        if (m) return m;
      }
      if (r.status !== 429) break;
    } catch { break; }
  }
  return null;
}

/** سلسلة الموديلات: المُعدّ في البيئة أولاً ثم البدائل — الحصص تختلف بين الموديلات */
function modelChain(): string[] {
  const list = [
    process.env.GEMINI_MODEL,
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
    "gemini-flash-latest",
  ].filter(Boolean) as string[];
  return Array.from(new Set(list));
}

type Attempt = { ok: true; segments: VisionSegment[] } | { ok: false; reason: string; retryable: boolean };

async function once(
  model: string, key: string, buf: Buffer, mime: string, timeoutMs: number
): Promise<Attempt> {
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
      const msg = String(j?.error?.message ?? r.status);
      // 429/5xx ازدحام مؤقت → قابلة لإعادة المحاولة
      const retryable = r.status === 429 || (r.status >= 500 && r.status < 600);
      return { ok: false, reason: "api_error:" + msg.slice(0, 80), retryable };
    }
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start < 0 || end <= start) return { ok: false, reason: "bad_shape", retryable: true };
    let arr: any;
    try {
      arr = JSON.parse(clean.slice(start, end + 1));
    } catch {
      return { ok: false, reason: "bad_shape", retryable: true };
    }
    if (!Array.isArray(arr)) return { ok: false, reason: "bad_shape", retryable: false };
    const segments: VisionSegment[] = arr
      .map((x: any) => ({
        text: String(x?.text ?? "").trim(),
        answer: String(x?.answer ?? "").trim().slice(0, 500) || null,
      }))
      .filter((s: VisionSegment) => s.text.length >= 10)
      .map((s: VisionSegment) => ({ text: s.text.slice(0, 2000), answer: s.answer }));
    if (!segments.length) return { ok: false, reason: "empty_result", retryable: true };
    return { ok: true, segments };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const timeout = msg.toLowerCase().includes("abort");
    return { ok: false, reason: timeout ? "timeout" : "network", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * تفريغ صورة بالرؤية مع تناوب المفاتيح والموديلات:
 * لكل مفتاح → كل موديل (محاولتان بفاصل 4ث لـ 503)؛
 * 429 حصة تعني: تخطَّ الموديل فوراً (الحصص تختلف بين الموديلات)،
 * وبعد نفاد موديلات المفتاح انتقل للمفتاح التالي؛
 * انتظار 15ث مرة واحدة فقط عند نفاد كل المفاتيح.
 */
const QUOTA_RE = /429|quota|exceed/i;
export async function transcribeImage(
  buf: Buffer,
  mime: string,
  timeoutMs = 75000,
  tenantKey?: string | null,
  tenantKey2?: string | null
): Promise<{ ok: true; segments: VisionSegment[] } | { ok: false; reason: string }> {
  const keys = visionChain(tenantKey, tenantKey2);
  if (!keys.length) return { ok: false, reason: "not_configured" };
  let last = "unknown";
  let quotaWaited = false;
  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    const lastKey = ki === keys.length - 1;
    for (const model of modelChain()) {
      let attempts = 0;
      while (attempts < 2) {
        if (attempts > 0) await sleep(4000); // يمتص 503 الموقتة
        attempts++;
        const r = await once(model, key, buf, mime, timeoutMs);
        if (r.ok) return r;
        last = r.reason;
        if (QUOTA_RE.test(r.reason)) break; // حصة هذا الموديل — جرّب الموديل التالي فوراً
        if (!r.retryable) break; // خطأ بنيوي — الموديل التالي مباشرة
      }
      await sleep(500);
    }
    if (lastKey) {
      if (QUOTA_RE.test(last) && !quotaWaited) {
        quotaWaited = true;
        await sleep(15000); // فرصة أخيرة واحدة بعد مهلة
        const r = await once(modelChain()[0], key, buf, mime, timeoutMs);
        if (r.ok) return r;
        last = r.reason;
      }
      return { ok: false, reason: last };
    }
    // مفاتيح أخرى متاحة — تابع الحلقة الخارجية
  }
  return { ok: false, reason: last };
}
