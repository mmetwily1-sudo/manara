import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const results: any = { url: url?.slice(0, 30), hasAnon: !!anon };
  try {
    const r1 = await fetch("https://example.com", { cache: "no-store" });
    results.example = r1.status;
  } catch (e: any) { results.exampleErr = String(e.message).slice(0, 200); }
  try {
    const r2 = await fetch(`${url}/rest/v1/tenants?select=id&limit=1`, {
      headers: { apikey: anon ?? "", Authorization: `Bearer ${anon}` },
      cache: "no-store",
    });
    results.supabaseStatus = r2.status;
    results.supabaseBody = (await r2.text()).slice(0, 300);
  } catch (e: any) { results.supabaseErr = String(e.message).slice(0, 300); results.cause = String((e as any)?.cause ?? "").slice(0, 300); }
  return NextResponse.json(results);
}
