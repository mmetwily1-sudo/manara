import { NextResponse } from "next/server";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";

/**
 * POST /api/questions/scan — المعلم يصور ورقة/يرفع صوراً.
 * multipart: images[] (حتى 8 صور، 8MB) + subject? + examTitle?
 * يحاول OCR محلياً؛ عند غيابه يحفظ الصور وينشئ مسودات نسخ يدوي.
 * المخرج دائماً مسودات خاصة (status=draft) — لا شيء يُنشر تلقائياً.
 * مع examTitle: يُنشأ امتحان غير منشور وتُوسم مسوداته به.
 */
const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024;

function run(cmd: string, args: string[], timeoutMs = 120000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, out: String(stderr ?? err.message).slice(0, 300) });
      else resolve({ ok: true, out: String(stdout).slice(0, 500) });
    });
  });
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
  for (const f of files) {
    if (!(f as File).type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "bad_type", message: "الملفات المقبولة صور فقط" }, { status: 400 });
    }
    if ((f as File).size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "too_large", message: "حجم الصورة يتجاوز 8MB" }, { status: 400 });
    }
  }
  const subject = String(form.get("subject") ?? "").trim().slice(0, 60) || "عام";
  const examTitle = String(form.get("examTitle") ?? "").trim().slice(0, 120);

  const ref = `scan-${Date.now().toString(36)}`;
  const work = await mkdtemp(join(tmpdir(), "scan-"));
  try {
    // 1) حفظ الصور مؤقتاً
    const paths: string[] = [];
    let i = 0;
    for (const f of files as File[]) {
      const ext = (f.type.split("/")[1] || "jpg").split("+")[0].replace(/[^a-z]/g, "") || "jpg";
      const p = join(work, `img${++i}.${ext}`);
      await writeFile(p, Buffer.from(await f.arrayBuffer()));
      paths.push(p);
    }

    // 2) معالجة + OCR (أو سقوط آمن)
    const outdir = join(work, "out");
    let manifest: any = null;
    let ocr = false;
    const script = join(process.cwd(), "scripts", "image_ingest.py");
    for (const py of ["python3", "python"]) {
      const r = await run(py, [script, outdir, "--ref", ref, "--subject", subject, ...paths]);
      if (r.ok) {
        try {
          const { readFile } = await import("node:fs/promises");
          manifest = JSON.parse(await readFile(join(outdir, "manifest.json"), "utf8"));
          ocr = !!manifest.ocr;
          break;
        } catch {}
      }
    }

    // 3) bucket
    try {
      await admin.storage.createBucket("exam-pages", { public: true });
    } catch {}

    // 4) امتحان؟ (غير منشور)
    let examId: string | null = null;
    if (examTitle) {
      const { data: ex } = await admin
        .from("exams")
        .insert({ tenant_id: tenantId, title: examTitle, duration_minutes: 30, total_marks: 0, is_published: false })
        .select("id")
        .single();
      examId = (ex as any)?.id ?? null;
    }

    const pageFiles: { page: number; buf: Buffer }[] = [];
    const segments: { page: number; text: string; needs_transcription?: boolean }[] = [];
    if (manifest) {
      const { readFile, readdir } = await import("node:fs/promises");
      const pngs = (await readdir(join(outdir, "pages"))).filter((x) => x.endsWith(".png")).sort();
      let n = 0;
      for (const f of pngs) {
        pageFiles.push({ page: ++n, buf: await readFile(join(outdir, "pages", f)) });
      }
      for (const s of manifest.segments ?? []) segments.push(s);
    } else {
      // سقوط آمن: الصور الأصلية + مسودات نسخ يدوي
      let n = 0;
      for (const p of paths) {
        const { readFile } = await import("node:fs/promises");
        pageFiles.push({ page: ++n, buf: await readFile(p) });
        segments.push({ page: n, text: `[صفحة ${n} — تُنسخ يدوياً من الصورة]`, needs_transcription: true });
      }
    }

    for (const pf of pageFiles) {
      const dst = `scans/${tenantId}/${ref}/p${String(pf.page).padStart(3, "0")}.png`;
      const { error } = await admin.storage.from("exam-pages").upload(dst, pf.buf, { contentType: "image/png", upsert: true });
      if (error) {
        return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
      }
    }

    const rows = segments.map((s) => ({
      tenant_id: tenantId,
      subject,
      lesson: null,
      lesson_code: null,
      difficulty: 3,
      qtype: "mcq",
      body: s.text.slice(0, 2000),
      options: null,
      correct_answer: null,
      marks: 1,
      source: "teacher",
      source_detail: JSON.stringify({ ref, page: s.page, kind: "scan", exam_id: examId, ocr }),
      visibility: "private",
      status: "draft",
    }));
    if (rows.length) {
      const { error } = await admin.from("questions").insert(rows);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, drafts: rows.length, pages: pageFiles.length, examId, ocr });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
