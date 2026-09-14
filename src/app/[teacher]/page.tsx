import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentRegisterForm } from "@/components/StudentRegisterForm";

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
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await admin.from("tenants").select("name,settings").eq("slug", slug).single();
      if (data?.name) displayName = data.name;
      teacherPhone = (data as any)?.settings?.owner_phone;
    }
  } catch {}
  if (!displayName) notFound();
  const headerName = displayName.startsWith("سنتر") ? displayName : `أ. ${displayName}`;
  const heroName = displayName;

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-light/30 to-bg">
      <header className="bg-white/80 backdrop-blur">
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

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[["🎬", "حصص مسجلة", "شاهدها في أي وقت من موبايلك"],
            ["📝", "امتحانات تدريبية", "بتتصحح فوراً ودرجتك توصلك"],
            ["🎓", "شهادات إتمام", "بتتولد لوحدها وتشاركها"]].map(([i, t, d]) => (
            <div key={t} className="card"><div className="text-3xl">{i}</div><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-small text-slate-600">{d}</p></div>
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
