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
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return data.map((g: any) => ({
      id: g.id, name: g.name, grade: g.grade_level, subject: g.subject,
      monthlyFee: Number(g.monthly_fee ?? 0), todaySlot: "—",
    }));
  } catch { return []; }
}

export async function getStudentsByGroup(groupId?: string) {
  const sb = supaServer();
  if (!sb) return demo.getStudentsByGroup(groupId);
  try {
    let q = sb.from("users").select("id,full_name,phone").eq("role", "student").limit(100);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return data.map((u: any) => ({ id: u.id, name: u.full_name, groupId: groupId ?? "g1", parentPhone: u.phone, status: "pending" as const }));
  } catch { return []; }
}

export async function getKpis() {
  const sb = supaServer();
  if (!sb) return demo.getKpis();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { count: present } = await sb.from("attendance").select("id", { count: "exact", head: true }).eq("status", "present").gte("recorded_at", today);
    const { count: absent } = await sb.from("attendance").select("id", { count: "exact", head: true }).eq("status", "absent").gte("recorded_at", today);
    const presentToday = present ?? 0;
    const absentToday = absent ?? 0;
    return { presentToday, absentToday, collectedMonth: 0, outstanding: 0, lateStudents: 0 };
  } catch { return { presentToday: 0, absentToday: 0, collectedMonth: 0, outstanding: 0, lateStudents: 0 }; }
}

export async function getEarlyWarning() {
  const sb = supaServer();
  if (!sb) return demo.getEarlyWarning();
  // حساب جديد: لا إنذارات وهمية
  return [];
}

export async function getFeed() {
  const sb = supaServer();
  if (!sb) return demo.getFeed();
  return [];
}

export async function getTenantInfoDB() {
  const sb = supaServer();
  // حاول أولاً عبر جلسة المستخدم (الأدق)
  if (sb) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: u } = await sb.from("users").select("tenant_id").eq("auth_user_id", uid).single();
        if (u?.tenant_id) {
          const { data: t } = await sb.from("tenants").select("name,slug,plan,primary_color").eq("id", u.tenant_id).single();
          if (t) return { name: t.name, slug: t.slug, plan: t.plan, color: t.primary_color };
        }
      }
    } catch {}
  }
  // fallback: حاول عبر الـ Host (يعمل حتى لو الجلسة غير جاهزة)
  try {
    const { headers } = await import("next/headers");
    const host = headers().get("host") ?? "";
    const h = host.split(":")[0].toLowerCase();
    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "manara.app";
    let slug: string | null = null;
    if (h.endsWith(".lvh.me")) slug = h.replace(/\.lvh\.me$/, "").split(".")[0];
    else if (h !== ROOT && h !== `www.${ROOT}` && h.endsWith(`.${ROOT}`)) slug = h.slice(0, -(ROOT.length + 1)).split(".")[0];
    if (slug && slug !== "www") {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const admin = createClient(url, key, { auth: { persistSession: false } });
        const { data: t } = await admin.from("tenants").select("name,slug,plan,primary_color").eq("slug", slug).single();
        if (t) return { name: t.name, slug: t.slug, plan: t.plan, color: t.primary_color };
      }
    }
  } catch {}
  // أخيراً: demo فقط لو Supabase غير مُعد
  if (!sb) return demo.getTenantInfo();
  // حساب جديد بدون بيانات بعد — أظهر حالة فارغة بدلاً من demo
  return { name: "سنترك الجديد", slug: "demo", plan: "trial", color: "#1A73E8" };
}
