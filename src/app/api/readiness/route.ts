import { NextResponse } from "next/server";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { requireTeacher } from "@/lib/server-auth";

function walk(dir: string, out: string[] = []): string[] {
  try {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory()) { if (e !== "node_modules" && e !== ".next") walk(p, out); }
        else out.push(p);
      } catch {}
    }
  } catch {}
  return out;
}

/** GET /api/readiness — فحص جاهزية الـ 100 جولة (مالك): توثيق + migrations + routes + env */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const root = process.cwd();
  const docs = walk(join(root, "docs")).filter((f) => /AI-PANEL-ROUND\d+\.md$/.test(f));
  const rounds = docs.map((f) => Number((f.match(/ROUND(\d+)\.md$/) || [])[1] ?? 0));
  const missing = Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !rounds.includes(n));
  const migrations = walk(join(root, "database", "migrations")).filter((f) => f.endsWith(".sql"));
  const routes = walk(join(root, "src", "app", "api")).filter((f) => f.endsWith("route.ts"));
  const pages = walk(join(root, "src", "app", "dashboard")).filter((f) => f.endsWith("page.tsx"));
  return NextResponse.json({
    ok: true,
    rounds: { done: rounds.length, target: 100, missing },
    migrations: migrations.length,
    api_routes: routes.length,
    dashboard_pages: pages.length,
    env: {
      supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      gemini: !!process.env.GEMINI_API_KEY,
      cron: !!process.env.CRON_SECRET,
      vapid: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    },
  });
}
