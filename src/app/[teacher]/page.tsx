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
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await admin.from("tenants").select("name,settings").eq("slug", slug).single();
      if (data?.name) displayName = data.name;
      teacherPhone = (data as any)?.settings?.owner_phone;
      const th = String((data as any)?.settings?.theme ?? "default");
      if (["default", "dark", "minimal"].includes(th)) theme = th;
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
