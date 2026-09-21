import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/omr/[id]/grade — تصحيح ورقة بابل شيت من صورة (معلم).
 * multipart: photo + student_name? — الرؤية تقرأ التظليل، وتُقارن بنموذج الإجابة.
 * الغامض يُعلَّم needs_review للمراجعة البشرية (لا ثقة عمياء).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "omr-grade", 30, 60 * 60 * 1000, tid)) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "تجاوزت حد التصحيح (30/ساعة)." }, { status: 429 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }
  const photo = form.get("photo");
  const studentName = String(form.get("student_name") ?? "").trim().slice(0, 100) || null;
  if (!(photo instanceof Blob) || photo.size === 0) {
    return NextResponse.json({ ok: false, error: "photo_required", message: "صوّر ورقة الإجابة أولاً." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES || !photo.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "bad_file", message: "صورة حتى 8MB فقط." }, { status: 400 });
  }

  try {
    const { data: sheet } = await admin.from("omr_sheets").select("*").eq("id", params.id).eq("tenant_id", tid).single();
    if (!sheet) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const s = sheet as any;
    const key: string[] = s.answer_key ?? [];

    const buf = Buffer.from(await (photo as File).arrayBuffer());
    try { await admin.storage.createBucket("omr", { public: false }); } catch {}
    const photoPath = `${tid}/${params.id}/${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from("omr").upload(photoPath, buf, { contentType: "image/png", upsert: true });
    if (upErr) return dbFail("omr-upload", upErr, "upload_failed");

    // قراءة التظليل بالرؤية (تناوب المفاتيح تلقائياً)
    const { data: trow } = await admin.from("tenants").select("settings").eq("id", tid).single();
    const { visionChain } = await import("@/lib/vision");
    const keys = visionChain((trow as any)?.settings?.vision_key ?? null, (trow as any)?.settings?.vision_key_2 ?? null);
    if (!keys.length) {
      return NextResponse.json({ ok: false, error: "no_key", message: "اربط مفتاح رؤية من الإعدادات أولاً." }, { status: 400 });
    }
    const letters = ["A", "B", "C", "D", "E", "F"].slice(0, s.num_choices).join("/");
    const prompt =
      `This is a photo of a bubble answer sheet with ${s.num_questions} numbered questions, ` +
      `each with choices ${letters}. For each question report the SINGLE darkest filled bubble. ` +
      `Return ONLY a JSON array, no markdown: [{"n": 1, "answer": "A|B|C|D|null", "unsure": false}]. ` +
      `Use null with unsure:true when blank or ambiguous. Cover all ${s.num_questions} questions.`;
    let items: { n: number; answer: string | null; unsure?: boolean }[] = [];
    let lastErr = "";
    for (const k of keys) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90000);
        const r = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + k,
          {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/png", data: buf.toString("base64") } }] }],
              generationConfig: { temperature: 0, maxOutputTokens: 4000 },
            }),
          }
        ).finally(() => clearTimeout(timer));
        const jj = await r.json().catch(() => null);
        const text: string = jj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
        if (r.ok && text) {
          const clean = text.replace(/```json|```/g, "").trim();
          const arr = JSON.parse(clean.slice(clean.indexOf("["), clean.lastIndexOf("]") + 1));
          if (Array.isArray(arr) && arr.length) { items = arr; break; }
        }
        lastErr = String((jj as any)?.error?.message ?? r.status).slice(0, 80);
        if (r.status !== 429) break;
      } catch { lastErr = "network"; break; }
    }
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "vision_failed", message: "تعذرت قراءة الورقة (" + lastErr + ") — أعد التصوير بإضاءة أفضل." }, { status: 502 });
    }

    const answers: (string | null)[] = [];
    let score = 0, unsure = 0;
    for (let i = 0; i < s.num_questions; i++) {
      const it = items.find((x) => x.n === i + 1);
      const a = it && typeof it.answer === "string" ? it.answer.toUpperCase() : null;
      answers.push(a);
      if (!a || it?.unsure) unsure++;
      else if (a === key[i]) score++;
    }
    const { data: result, error } = await admin.from("omr_results").insert({
      tenant_id: tid, sheet_id: params.id, student_name: studentName,
      answers, score, total: s.num_questions, needs_review: unsure > 0, photo_path: photoPath,
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({
      ok: true, id: (result as any).id, score, total: s.num_questions, unsure, needs_review: unsure > 0,
    });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json({ ok: false, error: "not_ready", message: "نفّذ ترحيل 006 من لوحة Supabase أولاً." }, { status: 400 });
    }
    return dbFail("omr-grade", e);
  }
}
