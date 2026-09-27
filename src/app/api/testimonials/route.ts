import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** GET /api/testimonials — آراء الثناء العامة (أسماء مخفاة) للتسويق */
export async function GET() {
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await admin.from("feedback").select("text,created_at,tenants(name),users(full_name)")
      .eq("kind", "praise").order("created_at", { ascending: false }).limit(12);
    const out = ((data ?? []) as any[])
      .filter((r) => String(r.text ?? "").trim().length >= 10)
      .slice(0, 6)
      .map((r) => {
        const full = String(r.users?.full_name ?? "معلم");
        const masked = full.split(/\s+/)[0] + " " + (full.split(/\s+/)[1]?.[0] ?? "") + ".";
        return { text: String(r.text).slice(0, 200), name: masked, center: (r.tenants as any)?.name ?? "" };
      });
    return NextResponse.json({ ok: true, testimonials: out });
  } catch {
    return NextResponse.json({ ok: true, testimonials: [] });
  }
}
