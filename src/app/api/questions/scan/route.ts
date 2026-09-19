import { NextResponse } from "next/server";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { isVisionLive, transcribeImage } from "@/lib/vision";

/**
 * POST /api/questions/scan — مسح ورقة بالكاميرا/رفع صور.
 * multipart: images[] (حتى 8، 8MB) + subject? + examTitle?
 * الترتيب: رؤية Gemini (إن وُجد المفتاح) → Tesseract محلي → نسخ يدوي.
 * يعمل على Vercel بدون بايثون (رؤية أو يدوي) — البايثون تحسين محلي فقط.
 * المخرج دائماً مسودات خاصة — لا شيء يُنشر تلقائياً.
 */
const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024;

function runPy(args: string[], timeoutMs = 120000): Promise<boolean> {
  return new Promise((resolve) => {
    const go = (cmd: string) => {
      execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err) => {
        if (err) resolve(false);
        else resolve(true);
      });
    };
    // جرّب python3 ثم python
    execFile("python3", ["--version"], (e3) => {
      if (!e3) go("python3");
      else go("python");
    });
  });
}

type Seg = { page: number; text: string; needs_transcription?: boolean; via: string };

async function extractPath(
  files: { buf: Buffer; mime: string }[],
  work: string,
  ref: string,
  subject: string
): Promise<{ segments: Seg[]; via: string } | null> {
  // 1) رؤية أولاً (HTTPS خالص — تعمل على أي استضافة)
  if (isVisionLive()) {
    const settled = await Promise.allSettled(
      files.map((f) => transcribeImage(f.buf, f.mime))
    );
    const segments: Seg[] = [];
    let n = 0;
    let anyOk = false;
    for (const s of settled) {
      n++;
      if (s.status === "fulfilled" && s.value.ok) {
        anyOk = true;
        for (const seg of s.value.segments) segments.push({ page: n, text: seg.text, via: "vision" });
      }
    }
    if (anyOk) return { segments, via: "vision" };
    // كلها فشلت → أكمل للمسارات التالية (صفحات يدوية)
  }
  // 2) بايثون/Tesseract محلياً
  try {
    const script = join(process.cwd(), "scripts", "image_ingest.py");
    const outdir = join(work, "out");
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const p = join(work, `img${i}.bin`);
      await writeFile(p, files[i].buf);
      paths.push(p);
    }
    const ok = await runPy([script, outdir, "--ref", ref, "--subject", subject, ...paths]);
    if (ok) {
      const { readFile } = await import("node:fs/promises");
      const manifest = JSON.parse(await readFile(join(outdir, "manifest.json"), "utf8"));
      return {
        segments: (manifest.segments ?? []).map((s: any) => ({
          page: s.page, text: s.text, needs_transcription: s.needs_transcription, via: "ocr",
        })),
        via: "ocr",
      };
    }
  } catch {}
  return null;
}

export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tenantId = res.ctx.tenantId;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }
  const files = [...form.getAll("images"), ...form.getAll("file")].filter(
    (f): f is File => f instanceof Blob && (f as File).size > 0
  );
  if (!files.length) return NextResponse.json({ ok: false, error: "images_required" }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ ok: false, error: "too_many", message: `حتى ${MAX_FILES} صور في المرة` }, { status: 400 });
  }
  const bufs: { buf: Buffer; mime: string }[] = [];
  for (const f of files as File[]) {
    if (!f.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "bad_type", message: "الملفات المقبولة صور فقط" }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "too_large", message: "حجم الصورة يتجاوز 8MB" }, { status: 400 });
    }
    bufs.push({ buf: Buffer.from(await f.arrayBuffer()), mime: f.type });
  }
  const subject = String(form.get("subject") ?? "").trim().slice(0, 60) || "عام";
  const examTitle = String(form.get("examTitle") ?? "").trim().slice(0, 120);

  const ref = `scan-${Date.now().toString(36)}`;
  const work = await mkdtemp(join(tmpdir(), "scan-"));
  try {
    try {
      await admin.storage.createBucket("exam-pages", { public: true });
    } catch {}

    let examId: string | null = null;
    if (examTitle) {
      const { data: ex } = await admin
        .from("exams")
        .insert({ tenant_id: tenantId, title: examTitle, duration_minutes: 30, total_marks: 0, is_published: false })
        .select("id")
        .single();
      examId = (ex as any)?.id ?? null;
    }

    const parsed = await extractPath(bufs, work, ref, subject);
    const via = parsed?.via ?? "manual";

    // خزّن الأصلية دائماً (مرجع المراجعة) — المعالجة للـ OCR فقط
    let n = 0;
    for (const f of bufs) {
      const dst = `scans/${tenantId}/${ref}/p${String(++n).padStart(3, "0")}.png`;
      const { error } = await admin.storage.from("exam-pages").upload(dst, f.buf, { contentType: "image/png", upsert: true });
      if (error) {
        return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
      }
    }

    const segments: Seg[] = parsed?.segments ?? bufs.map((_, i) => ({
      page: i + 1, text: `[صفحة ${i + 1} — تُنسخ يدوياً من الصورة]`, needs_transcription: true, via: "manual" as const,
    }));

    const { splitQuestion } = await import("@/lib/parse-options");
    const rows = segments.map((s) => {
      const qa = splitQuestion(s.text);
      return {
        tenant_id: tenantId,
        subject,
        lesson: null,
        lesson_code: null,
        difficulty: 3,
        qtype: "mcq",
        body: qa.stem.slice(0, 2000) || s.text.slice(0, 2000),
        options: qa.options.length >= 2 ? qa.options : null,
        correct_answer: null,
        marks: 1,
        source: "teacher",
        source_detail: JSON.stringify({ ref, page: s.page, kind: "scan", exam_id: examId, ocr: via !== "manual", via }),
        visibility: "private",
        status: "draft",
      };
    });
    if (rows.length) {
      const { error } = await admin.from("questions").insert(rows);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, drafts: rows.length, pages: bufs.length, examId, ocr: via !== "manual", via });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
