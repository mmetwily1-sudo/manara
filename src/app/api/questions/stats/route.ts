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
  return createServerClient(SUPA_URL, ANON, { cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } } });
}

/** GET /api/questions/stats — عدد أسئلة البنك لكل مستوى صعوبة */
export async function GET() {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const urow = { tenant_id: res.ctx.tenantId };

  const { data: rows } = await admin.from("questions").select("difficulty").eq("tenant_id", urow.tenant_id).limit(2000);
  const byLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of (rows ?? []) as any[]) {
    const d = Number(r.difficulty);
    if (byLevel[d] !== undefined) byLevel[d]++;
    total++;
  }
  return NextResponse.json({ ok: true, total, byLevel });
}
