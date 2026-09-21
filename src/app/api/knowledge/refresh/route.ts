import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/knowledge/refresh — مراقب الوزارة: يجلب عناوين moe.gov.eg
 * ويخزن الجديد (قرار/كتاب دوري/امتحان/منهج) في قاعدة المعرفة. teacher فقط، 5/ساعة.
 * بلا مفاتيح خارجية — HTTPS مباشر.
 */
const SOURCES = [
  { url: "https://moe.gov.eg/", system: "moe" },
];

const WANT = /قرار|كتاب دوري|قانون|امتحان|نتيجة|منهج|جدول|تنسيق|مصروفات/i;

function extractTitles(html: string): string[] {
  const out: string[] = [];
  const re = /<a[^>]*>([^<]{15,200})<\/a>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) !== null && out.length < 40) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (WANT.test(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();

  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "knowledge-refresh", 5, 60 * 60 * 1000, res.ctx.tenantId)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let added = 0, checked = 0;
  const errors: string[] = [];
  for (const s of SOURCES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(s.url, { signal: ctrl.signal, headers: { "User-Agent": "ManaraBot/1.0" } }).finally(() => clearTimeout(timer));
      if (!r.ok) { errors.push(s.url + ":" + r.status); continue; }
      const html = await r.text();
      const titles = extractTitles(html);
      checked += titles.length;
      for (const title of titles) {
        const { data: dup } = await admin.from("edu_knowledge").select("id").eq("title", title).limit(1);
        if (dup?.length) continue;
        const kind = /قرار|كتاب دوري|قانون/.test(title) ? "ministry_decree" : "curriculum_note";
        const { error } = await admin.from("edu_knowledge").insert({
          kind, system: s.system, title, body: title, source_url: s.url,
        });
        if (!error) added++;
      }
    } catch {
      errors.push(s.url + ":network");
    }
  }
  return NextResponse.json({ ok: true, checked, added, errors });
}
