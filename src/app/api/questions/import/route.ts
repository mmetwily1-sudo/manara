import { NextResponse } from "next/server";
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
export async function POST(req: Request) {
  const sbUser = supaUser();
  const { data: { user } } = sbUser ? await sbUser.auth.getUser() : { data: { user: null } } as any;
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "file required" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: any[] = [];

  // Ø¬Ø±Ù‘Ø¨ xlsx Ø£ÙˆÙ„Ø§Ù‹ (Ø¥Ù† ØªÙˆÙØ±)ØŒ Ø« CSV ÙƒØ¨Ø¯ÙŠÙ„
  try {
    const XLSX: any = await import("xlsx").catch(() => null);
    if (XLSX) {
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
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

  const admin = createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("tenant_id").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });

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


