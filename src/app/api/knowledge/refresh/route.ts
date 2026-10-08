import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/knowledge/refresh — حلقة التعلم الذاتي:
 * 1) يكتشف روابط (قرارات/أخبار/مناهج) من بوابة الوزارة ويزور أهمها.
 * 2) يستخرج العناوين المهمة ويخزن الجديد في قاعدة المعرفة.
 * 3) يغلق الفجوات المفتوحة التي أصبح لها محتوى مطابق.
 * teacher (أو cron بـ CRON_SECRET). حد 5/ساعة. بلا مفاتيح خارجية.
 */
const SOURCES = [
  { url: "https://moe.gov.eg/", system: "moe" },
  { url: "https://www.azhar.eg/", system: "azhar" },
];

const WANT = /قرار|كتاب دوري|قانون|امتحان|نتيجة|منهج|جدول|تنسيق|مصروفات|بكالوريا|ثانوية/i;
const LINK_WANT = /قرار|قانون|كتاب-دوري|كتب-دورية|news|أخبار|اخبار|مناهج|manahg|decree/i;

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ManaraBot/1.0" } }).finally(() => clearTimeout(timer));
    if (!r.ok) return null;
    const t = await r.text();
    return t.length > 500 ? t : null;
  } catch {
    return null;
  }
}

function extractTitles(html: string): string[] {
  const out: string[] = [];
  const re = /<a[^>]*>([^<]{15,200})<\/a>/gi;
  let m: RegExpExecArray | null;
  const seen: Record<string, boolean> = {};
  while ((m = re.exec(html)) !== null && out.length < 40) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (WANT.test(t) && !seen[t]) {
      seen[t] = true;
      out.push(t);
    }
  }
  return out;
}

function discoverLinks(html: string, base: string): string[] {
  const out: string[] = [];
  const seen: Record<string, boolean> = {};
  const re = /<a[^>]*href="([^"]+)"[^>]*>([^<]{5,120})<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 12) {
    const href = m[1];
    const text = m[2].replace(/\s+/g, " ").trim();
    if (!LINK_WANT.test(href + " " + text)) continue;
    try {
      const abs = new URL(href, base).toString();
      if (abs.startsWith("http") && !seen[abs] && abs.length < 300) {
        seen[abs] = true;
        out.push(abs);
      }
    } catch {}
  }
  return out.slice(0, 5);
}

function classify(title: string): string {
  if (/قرار|كتاب دوري|قانون/.test(title)) return "ministry_decree";
  return "curriculum_note";
}

export async function GET(req: Request) {
  // cron فيرسل GET حصراً — يقبل cron فقط
  const cronSecret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return doRefresh(req, null);
}

export async function POST(req: Request) {
  // cron الرسمي (Vercel) أو معلم
  const cronSecret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  let tid: string | null = null;
  if (!isCron) {
    const { requireTeacher, adminClient } = await import("@/lib/server-auth");
    const res = await requireTeacher(["teacher_admin"]);
    if ("error" in res) return res.error;
    tid = res.ctx.tenantId;
    const { isRateLimited } = await import("@/lib/rate-limit");
    if (await isRateLimited(req, "knowledge-refresh", 5, 60 * 60 * 1000, tid)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  }
  return doRefresh(req, tid);
}

async function doRefresh(req: Request, tid: string | null) {
  void req; void tid;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  let added = 0, checked = 0, pages = 0;
  const errors: string[] = [];
  for (const s of SOURCES) {
    const home = await fetchText(s.url);
    if (!home) { errors.push(s.url + ":network"); continue; }
    const urls = [s.url, ...discoverLinks(home, s.url)];
    for (const u of urls) {
      const html = u === s.url ? home : await fetchText(u);
      if (!html) continue;
      pages++;
      const titles = extractTitles(html);
      checked += titles.length;
      for (const title of titles) {
        const { data: dup } = await admin.from("edu_knowledge").select("id").eq("title", title).limit(1);
        if (dup?.length) continue;
        const { error } = await admin.from("edu_knowledge").insert({
          kind: classify(title), system: s.system, title, body: title, source_url: u,
        });
        if (!error) added++;
      }
      if (pages >= 8) break;
    }
  }

  // إغلاق الفجوات التي أصبح لها محتوى
  let closed = 0;
  try {
    const { data: gaps } = await admin.from("knowledge_gaps").select("id,query").eq("status", "open").limit(50);
    for (const g of (gaps ?? []) as any[]) {
      const words = String(g.query).split(/\s+/).filter((w: string) => w.length >= 4).slice(0, 3);
      if (!words.length) continue;
      const ors = words.map((w) => `title.ilike.%${w}%`).join(",");
      const { data: hit } = await admin.from("edu_knowledge").select("id").or(ors).limit(1);
      if (hit?.length) {
        await admin.from("knowledge_gaps").update({ status: "filled" }).eq("id", g.id);
        closed++;
      }
    }
  } catch {}

  return NextResponse.json({ ok: true, checked, added, pages, closed, errors });
}
