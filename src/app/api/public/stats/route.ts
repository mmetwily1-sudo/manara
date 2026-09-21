import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/public/stats — أرقام تسويقية حية (بلا بيانات حساسة).
 * تُستخدم في شريط الإثبات بالصفحة الرئيسية. تخزين مؤقت ساعة.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const tenantsRes = await admin.from("tenants").select("id,settings").eq("status", "active").limit(2000);
    const demoIds = new Set(
      ((tenantsRes.data ?? []) as any[]).filter((t) => (t.settings as any)?.is_demo).map((t) => t.id)
    );
    const centers = ((tenantsRes.data ?? []) as any[]).filter((t) => !demoIds.has(t.id)).length;
    const realIds = ((tenantsRes.data ?? []) as any[]).filter((t) => !demoIds.has(t.id)).map((t) => t.id);
    const [qRes, eRes] = await Promise.all([
      realIds.length
        ? admin.from("questions").select("id", { count: "exact", head: true }).eq("status", "approved").in("tenant_id", realIds)
        : { count: 0 },
      realIds.length
        ? admin.from("exams").select("id", { count: "exact", head: true }).eq("is_published", true).in("tenant_id", realIds)
        : { count: 0 },
    ]);
    return NextResponse.json({
      ok: true,
      questions: (qRes as any).count ?? 0,
      exams: (eRes as any).count ?? 0,
      centers,
    });
  } catch {
    return NextResponse.json({ ok: true, questions: 0, exams: 0, centers: 0 });
  }
}
