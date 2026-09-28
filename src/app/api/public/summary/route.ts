import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyApiKey } from "@/lib/api-key";

/** GET /api/public/summary?key= — ملخص السنتر العام (بوابة المطورين، تحتاج مفتاحاً) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-api-key") || "";
  const tid = await verifyApiKey(key);
  if (!tid) return NextResponse.json({ ok: false, error: "bad_key" }, { status: 401 });
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const [{ data: t }, bRes, gRes, fRes] = await Promise.all([
      admin.from("tenants").select("name,slug,logo_url,primary_color").eq("id", tid).single(),
      admin.from("branches").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
      admin.from("groups").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
      admin.from("alumni").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("featured", true),
    ]);
    return NextResponse.json({
      ok: true,
      tenant: t ?? null,
      counts: { branches: bRes.count ?? 0, groups: gRes.count ?? 0, featured_alumni: fRes.count ?? 0 },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 500 });
  }
}
