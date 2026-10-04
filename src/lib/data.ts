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
        cookiesToSet.forEach(({ name, value, options }: any) => { try { store.set(name, value, options); } catch {} });
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
    let ids: string[] | null = null;
    if (groupId) {
      const { data: enr, error: eErr } = await sb
        .from("enrollments")
        .select("student_id")
        .eq("group_id", groupId)
        .eq("status", "active");
      if (eErr) throw eErr;
      ids = (enr ?? []).map((e: any) => e.student_id);
      if (!ids.length) return [];
    }
    let q = sb.from("users").select("id,full_name,phone").eq("role", "student").limit(200);
    if (ids) q = q.in("id", ids);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return data.map((u: any) => ({ id: u.id, name: u.full_name, groupId: groupId ?? "", parentPhone: u.phone, status: "pending" as const }));
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

/** إنذار تسرب حقيقي: غياب 14 يوماً / غياب متكرر / مديونية قديمة (بلا وهميات — فراغ = لا إنذار) */
export async function getEarlyWarning() {
  const sb = supaServer();
  if (!sb) return demo.getEarlyWarning();
  try {
    const { data: students } = await sb.from("users").select("id,full_name").eq("role", "student").limit(300);
    if (!students?.length) return [];
    const ids = (students as any[]).map((s) => s.id);
    const cutoff = new Date(Date.now() - 14 * 864e5).toISOString();
    const [{ data: att }, { data: inv }] = await Promise.all([
      sb.from("attendance").select("student_id,status,created_at").in("student_id", ids).gte("created_at", cutoff).limit(3000),
      sb.from("invoices").select("student_id,amount,paid,period").in("student_id", ids).neq("status", "paid").limit(1000),
    ]);
    const lastSeen: Record<string, string> = {};
    const abs: Record<string, number> = {};
    ((att ?? []) as any[]).forEach((a) => {
      if (!lastSeen[a.student_id] || a.created_at > lastSeen[a.student_id]) lastSeen[a.student_id] = a.created_at;
      if (a.status === "absent") abs[a.student_id] = (abs[a.student_id] ?? 0) + 1;
    });
    const due: Record<string, { sum: number; oldest: string }> = {};
    ((inv ?? []) as any[]).forEach((x) => {
      const rest = Number(x.amount ?? 0) - Number(x.paid ?? 0);
      if (rest <= 0) return;
      const d = due[x.student_id] ??= { sum: 0, oldest: x.period };
      d.sum += rest;
      if (String(x.period) < d.oldest) d.oldest = x.period;
    });
    const out: { id: string; name: string; detail: string; reason: string }[] = [];
    for (const s of students as any[]) {
      const reasons: string[] = [];
      if (!lastSeen[s.id]) reasons.push("لا حضور منذ 14 يوماً 🔴");
      else if ((abs[s.id] ?? 0) >= 3) reasons.push(`غياب متكرر (${abs[s.id]} مرات) 🟡`);
      const dd = due[s.id];
      if (dd && dd.sum > 0) {
        const ageD = Math.floor((Date.now() - new Date(`${dd.oldest}-01T00:00:00Z`).getTime()) / 864e5);
        if (ageD > 45) reasons.push(`مديونية قديمة ${dd.sum.toLocaleString("ar-EG")} ج 🟡`);
      }
      if (reasons.length) out.push({ id: s.id, name: s.full_name, detail: reasons.join(" · "), reason: reasons.length > 1 ? "خطر مركّب" : "يحتاج متابعة" });
      if (out.length >= 8) break;
    }
    return out;
  } catch { return []; }
}

export async function getFeed() {
  const sb = supaServer();
  if (!sb) return demo.getFeed();
  return [];
}

/** عدّاد التجربة: أيام متبقية + حالة (active/expiring/expired/paid) */
export function withTrial(t: { name: string; slug: string; plan: string; primary_color: string; trial_ends_at?: string | null; settings?: any }) {
  const paidUntil = t.settings?.plan_paid_until as string | undefined;
  if (t.plan !== "trial" && paidUntil) {
    const d = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 864e5);
    return { name: t.name, slug: t.slug, plan: t.plan, color: t.primary_color, trialDaysLeft: d, trialState: "paid" as const };
  }
  if (!t.trial_ends_at) return { name: t.name, slug: t.slug, plan: t.plan, color: t.primary_color, trialDaysLeft: null as number | null, trialState: "unknown" as const };
  const d = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 864e5);
  return {
    name: t.name, slug: t.slug, plan: t.plan, color: t.primary_color, trialDaysLeft: d,
    trialState: (d <= 0 ? "expired" : d <= 3 ? "expiring" : "active") as "expired" | "expiring" | "active",
  };
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
          const { data: t } = await sb.from("tenants").select("name,slug,plan,primary_color,trial_ends_at,settings").eq("id", u.tenant_id).single();
          if (t) return withTrial(t as any);
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
        const { data: t } = await admin.from("tenants").select("name,slug,plan,primary_color,trial_ends_at,settings").eq("slug", slug).single();
        if (t) return withTrial(t as any);
      }
    }
  } catch {}
  // أخيراً: demo فقط لو Supabase غير مُعد
  if (!sb) return { ...demo.getTenantInfo(), trialDaysLeft: null as number | null, trialState: "unknown" as const };
  // حساب جديد بدون بيانات بعد — أظهر حالة فارغة بدلاً من demo
  return { name: "سنترك الجديد", slug: "demo", plan: "trial", color: "#1A73E8", trialDaysLeft: null as number | null, trialState: "unknown" as const };
}
