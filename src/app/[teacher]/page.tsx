import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentRegisterForm } from "@/components/StudentRegisterForm";
import { PhoneLoginForm } from "@/components/PhoneLoginForm";

/**
 * صفحة المعلم العامة — Programmatic SEO
 * على الدومين الحقيقي بتشتغل تحت subdomain المعلم عبر middleware rewrite.
 * في وضع التصدير الثابت (GitHub Pages preview) بتتبني كصفحات ثابتة معروفة.
 */

type Props = { params: { teacher: string } };

// TODO Phase 2: استعلام فعلي من tenants — حالياً الـtenants التجريبية فقط
const KNOWN_SLUGS = ["demo"];

export function generateStaticParams() {
  return KNOWN_SLUGS.map((teacher) => ({ teacher }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeURIComponent(params.teacher);
  let titleName = slug;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await admin.from("tenants").select("name").eq("slug", slug).single();
      if (data?.name) titleName = data.name;
    }
  } catch {}
  return {
    title: `${titleName} — منصة تعليمية على منارة`,
    description: `كورسات ومجموعات وحصص مسجلة مع ${titleName} — سجل ابني في مجموعة الآن.`,
  };
}

export default async function TeacherPage({ params }: Props) {
  const slug = decodeURIComponent(params.teacher);
  let displayName: string | null = null;
  let teacherPhone: string | undefined;
  let theme: string = "default";
  let tenantId: string | null = null;
  let sessions: any[] = [];
  let videos: any[] = [];
  let notes: any[] = [];
  let examsCount = 0;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await admin.from("tenants").select("id,name,settings").eq("slug", slug).single();
      if (data?.name) displayName = data.name;
      teacherPhone = (data as any)?.settings?.owner_phone;
      const th = String((data as any)?.settings?.theme ?? "default");
      if (["default", "dark", "minimal"].includes(th)) theme = th;
      tenantId = (data as any)?.id ?? null;
    }
    if (tenantId) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const today = new Date().toISOString().slice(0, 10);
      const [ss, vv, nn, ee] = await Promise.all([
        admin.from("sessions").select("session_date,topic,groups(name)").eq("tenant_id", tenantId).gte("session_date", today).order("session_date").limit(6),
        admin.from("videos").select("title,duration_sec").eq("tenant_id", tenantId).eq("visibility", "free").order("created_at", { ascending: false }).limit(4),
        admin.from("notes").select("title,subject").eq("tenant_id", tenantId).eq("visibility", "public").order("created_at", { ascending: false }).limit(4),
        admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_published", true),
      ]);
      sessions = (ss.data ?? []) as any[];
      videos = (vv.data ?? []) as any[];
      notes = (nn.data ?? []) as any[];
      examsCount = ee.count ?? 0;
    }
  } catch {}
  if (!displayName) notFound();
  const headerName = displayName.startsWith("سنتر") ? displayName : `أ. ${displayName}`;
  const heroName = displayName;

  const themes: Record<string, { main: string; header: string; card: string }> = {
    default: { main: "min-h-screen bg-gradient-to-b from-primary-light/30 to-bg", header: "bg-white/80 backdrop-blur", card: "card" },
    dark: { main: "min-h-screen bg-slate-950 text-slate-100", header: "bg-slate-900/90 backdrop-blur", card: "rounded-xl border border-slate-800 bg-slate-900 p-5" },
    minimal: { main: "min-h-screen bg-white", header: "bg-white border-b border-slate-200", card: "rounded-xl border border-slate-200 p-5" },
  };
  const th = themes[theme];
  return (
    <main className={th.main}>
      <header className={th.header}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <span className="text-h2 font-extrabold text-primary">{headerName}</span>
          <Link href="/login" className="btn-secondary !px-4 !py-2 text-small">دخول الطلاب</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-display">منصة {heroName} التعليمية</h1>
        <p className="mx-auto mt-4 max-w-xl text-body text-slate-600">
          سجل بياناتك وسيتم إنشاء حسابك فوراً — بيانات الدخول ستظهر لك على الشاشة.
        </p>

        <StudentRegisterForm slug={slug} teacherPhone={teacherPhone} />
        <PhoneLoginForm slug={slug} />

        {(sessions.length > 0 || videos.length > 0 || notes.length > 0 || examsCount > 0) && (
          <div className="mt-14 space-y-8 text-right">
            {sessions.length > 0 && (
              <div>
                <h2 className="mb-3 font-extrabold">🗓️ الحصص القادمة</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sessions.map((s, i) => (
                    <div key={i} className={th.card}>
                      <div className="font-bold">{(s.groups as any)?.name ?? "حصة"}</div>
                      <div className="mt-1 text-small opacity-70" dir="ltr">{String(s.session_date ?? "").slice(0, 10)}</div>
                      {s.topic && <div className="mt-1 text-small opacity-70">{s.topic}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {videos.length > 0 && (
              <div>
                <h2 className="mb-3 font-extrabold">🎬 حصص مجانية</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {videos.map((v, i) => (
                    <div key={i} className={th.card}><div className="font-bold">{v.title}</div></div>
                  ))}
                </div>
              </div>
            )}
            {notes.length > 0 && (
              <div>
                <h2 className="mb-3 font-extrabold">📚 مذكرات</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {notes.map((n, i) => (
                    <div key={i} className={th.card}>
                      <div className="font-bold">{n.title}</div>
                      {n.subject && <div className="mt-1 text-small opacity-70">{n.subject}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {examsCount > 0 && (
              <p className="text-center text-small font-bold opacity-70">📝 {examsCount} امتحان تدريبي متاح لطلاب السنتر</p>
            )}
          </div>
        )}

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[["🎬", "حصص مسجلة", "شاهدها في أي وقت من موبايلك"],
            ["📝", "امتحانات تدريبية", "بتتصحح فوراً ودرجتك توصلك"],
            ["🎓", "شهادات إتمام", "بتتولد لوحدها وتشاركها"]].map(([i, t, d]) => (
            <div key={t} className={th.card}><div className="text-3xl">{i}</div><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-small opacity-70">{d}</p></div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-6 text-center text-xs text-slate-400">
        مدعوم بمنارة —{" "}
        <Link href="/" className="underline">اعمل منصتك الخاصة</Link>
      </footer>
    </main>
  );
}
