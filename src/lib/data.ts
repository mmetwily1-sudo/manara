/**
 * طبقة البيانات — الفاصل بين الواجهة وقاعدة البيانات
 * إذا كانت مفاتيح Supabase موجودة → استعلامات حقيقية
 * وإلا → ترجع بيانات تجريبية (demo-data) — التطبيق يفضل شغال دائماً
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as demo from "./demo-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaServer() {
  if (!url || !anon) return null;
  const store = cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(cookiesToSet: any[]) {
        cookiesToSet.forEach(({ name, value, options }: any) => store.set(name, value, options));
      },
    },
  });
}

export async function getGroups() {
  const sb = supaServer();
  if (!sb) return demo.getGroups();
  try {
    const { data, error } = await sb.from("groups").select("id,name,grade_level,subject,monthly_fee,schedule").order("created_at");
    if (error || !data || data.length === 0) return demo.getGroups();
    return data.map((g: any) => ({
      id: g.id, name: g.name, grade: g.grade_level, subject: g.subject,
      monthlyFee: Number(g.monthly_fee ?? 0), todaySlot: "—",
    }));
  } catch { return demo.getGroups(); }
}

export async function getStudentsByGroup(groupId?: string) {
  const sb = supaServer();
  if (!sb) return demo.getStudentsByGroup(groupId);
  try {
    let q = sb.from("users").select("id,full_name,phone").eq("role", "student").limit(100);
    const { data } = await q;
    if (!data || data.length === 0) return demo.getStudentsByGroup(groupId);
    return data.map((u: any) => ({ id: u.id, name: u.full_name, groupId: groupId ?? "g1", parentPhone: u.phone, status: "pending" as const }));
  } catch { return demo.getStudentsByGroup(groupId); }
}

export async function getKpis() {
  const sb = supaServer();
  if (!sb) return demo.getKpis();
  try {
    // محاولة سريعة: لو فشل لأي سبب نرجع التجريبية
    const today = new Date().toISOString().slice(0, 10);
    const { count: present } = await sb.from("attendance").select("id", { count: "exact", head: true }).eq("status", "present").gte("recorded_at", today);
    return { presentToday: present ?? demo.getKpis().presentToday, absentToday: demo.getKpis().absentToday, collectedMonth: demo.getKpis().collectedMonth, outstanding: demo.getKpis().outstanding, lateStudents: demo.getKpis().lateStudents };
  } catch { return demo.getKpis(); }
}

export async function getTenantInfoDB() {
  const sb = supaServer();
  if (!sb) return demo.getTenantInfo();
  try {
    const { data: { session } } = await sb.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return demo.getTenantInfo();
    const { data: u } = await sb.from("users").select("tenant_id").eq("auth_user_id", uid).single();
    if (!u?.tenant_id) return demo.getTenantInfo();
    const { data: t } = await sb.from("tenants").select("name,slug,plan,primary_color").eq("id", u.tenant_id).single();
    if (!t) return demo.getTenantInfo();
    return { name: t.name, slug: t.slug, plan: t.plan, color: t.primary_color };
  } catch { return demo.getTenantInfo(); }
}
