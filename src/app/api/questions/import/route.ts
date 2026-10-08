import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
}

/**
 * POST /api/questions/import â€” Ø§Ø³ØªÙŠØ±Ø§Ø¯ Excel/CSV
 * Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„ØªÙˆÙ‚Ø¹Ø© (ØµÙ Ø£ÙˆÙ„ Ø¹Ù†Ø§ÙˆÙŠÙ†):
 * subject | lesson | difficulty(1-5) | qtype(mcq/true_false/short_answer) | body | options(JSON Ø£Ùˆ ÙØµÙˆÙ„Ø© Ø¨Ù€|) | correct_answer | marks
 * Ø«Ø§Ù„ options: ["Ø£","Ø¨","Ø¬","Ø¯"]  Ø£Ùˆ  "Ø£|Ø¨|Ø¬|Ø¯"
 */
/**
 * محلل النص المجمع: كتل مفصولة بسطر فارغ.
 * مثال الكتلة:
 *   ما ناتج 2+2؟
 *   أ) 3
 *   ب) 4
 *   ج) 5
 *   =: 4
 */
function parseBulkText(text: string): any[] {
  const rows: any[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  for (const b of blocks) {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const body = lines[0].replace(/^س:\s*/, "");
    const options: string[] = [];
    let correct: string | null = null;
    let tf: string | null = null;
    for (const l of lines.slice(1)) {
      const ans = l.match(/^=:\s*(.+)$/);
      if (ans) { correct = ans[1].trim(); continue; }
      const opt = l.match(/^[أ-يa-dA-D][).\-:]\s*(.+)$/);
      if (opt) { options.push(opt[1].trim()); continue; }
      if (/^(صح|خطأ|true|false)$/i.test(l)) { tf = /^(صح|true)$/i.test(l) ? "صح" : "خطأ"; continue; }
    }
    if (!body) continue;
    if (tf) rows.push({ body, qtype: "true_false", correct_answer: tf });
    else if (options.length >= 2) rows.push({ body, qtype: "mcq", options, correct_answer: correct });
    else rows.push({ body, qtype: "short_answer", correct_answer: correct });
  }
  return rows;
}

export async function POST(req: Request) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const tres = await requireTeacher(R.content);
  if ("error" in tres) return tres.error;
  const tctx = tres.ctx;
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (await isRateLimited(req, "import", 20, 60 * 60 * 1000, tctx.tenantId)) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "تجاوزت حد الاستيراد (20/ساعة) — انتظر قليلاً." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });
  // سقف حجم الملف (2MB) وعدد الصفوف لمنع الإغراق
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "too_large", message: "حجم الملف يتجاوز 2MB." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mode = (form?.get("mode") as string) || "auto";
  let rows: any[] = [];

  if (mode === "text") {
    // استيراد نصي: سؤال لكل كتلة مفصولة بسطر فارغ
    // الصيغة: السطر الأول نص السؤال، ثم سطور "أ) ..." للاختيارات، وسطر "=: ..." للإجابة
    rows = parseBulkText(buf.toString("utf8"));
    if (!rows.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  } else {
    // Excel عبر exceljs (بديل آمن — مكتبة xlsx متروكة بثغرات بلا إصلاح)، ثم CSV كبديل
    try {
      const ExcelJS: any = await import("exceljs").catch(() => null);
      if (ExcelJS) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as any);
        const ws = wb.worksheets?.[0];
        if (ws) {
          const headers: string[] = [];
          ws.getRow(1).eachCell((c: any, col: number) => { headers[col - 1] = String(c.value ?? "").trim(); });
          ws.eachRow((row: any, n: number) => {
            if (n === 1) return;
            const r: any = {};
            row.eachCell((c: any, col: number) => {
              const h = headers[col - 1];
              if (h) r[h] = (c.text ?? String(c.value ?? "")).toString().trim();
            });
            rows.push(r);
          });
        }
      }
    } catch {}
    if (rows.length === 0) {
      const text = buf.toString("utf8");
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
      const headers = lines[0].split(",").map((h) => h.trim());
      rows = lines.slice(1).map((l) => {
        const vals = l.split(","); const r: any = {};
        headers.forEach((h, i) => (r[h] = vals[i]?.trim() ?? ""));
        return r;
      });
    }
  }

  // سقف الصفوف ضد ملفات الإغراق
  if (rows.length > 2000) {
    return NextResponse.json({ ok: false, error: "too_many", message: "الحد الأقصى 2000 سؤال في الملف الواحد." }, { status: 400 });
  }

  const admin = tctx.admin;
  const urow = { tenant_id: tctx.tenantId };

  let ok = 0, bad = 0;
  for (const r of rows) {
    const body = (r.body ?? r.question ?? "").toString().trim();
    if (!body) { bad++; continue; }
    let options: any = r.options ?? null;
    if (typeof options === "string" && options.includes("|")) options = options.split("|").map((s: string) => s.trim()).filter(Boolean);
    else if (typeof options === "string" && options.startsWith("[")) { try { options = JSON.parse(options); } catch {} }
    const ins: any = {
      tenant_id: urow.tenant_id, subject: (r.subject ?? "عام").toString().trim(),
      lesson: r.lesson ? r.lesson.toString().trim() : null,
      difficulty: Math.min(5, Math.max(1, Number(r.difficulty ?? 2) || 2)),
      qtype: (r.qtype ?? "mcq").toString().trim() || "mcq",
      body, options, correct_answer: r.correct_answer != null ? r.correct_answer : null,
      marks: Number(r.marks ?? 1) || 1,
    };
    const { error } = await admin.from("questions").insert(ins);
    if (error) bad++; else ok++;
  }

  return NextResponse.json({ ok: true, imported: ok, skipped: bad, total: rows.length });
}


