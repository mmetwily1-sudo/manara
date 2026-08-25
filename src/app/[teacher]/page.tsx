import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenantContext } from "@/lib/tenant";

type Props = { params: { teacher: string } };

/**
 * صفحة المعلم العامة — Programmatic SEO
 * تُعرض على: ahmed.manara.app أو الدومين المخصص
 * البيانات حالياً placeholder — هترتبط بجدول tenants لما نشبك Supabase
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `أ. ${params.teacher} — منصة تعليمية على منارة`,
    description: `كورسات ومجموعات وحصص مسجلة مع أ. ${params.teacher} — سجل ابني في مجموعة الآن.`,
  };
}

export default function TeacherPage({ params }: Props) {
  const tenant = getTenantContext();

  // TODO Phase 2: استعلام فعلي من tenants حسب slug/custom_domain
  // حالياً: الـtenants المعروفين فقط — أي رابط غلط ياخد 404 مرتبة بدل صفحة وهمية
  const KNOWN_SLUGS = ["demo"];
  const name = decodeURIComponent(params.teacher);
  if (!KNOWN_SLUGS.includes(name.toLowerCase())) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-light/30 to-bg">
      <header className="bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <span className="text-h2 font-extrabold" style={{ color: "var(--tenant-primary)" }}>
            أ. {name}
          </span>
          <Link href="/login" className="btn-secondary !px-4 !py-2 text-small">دخول الطلاب</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-display">منصة أ. {name} التعليمية</h1>
        <p className="mx-auto mt-4 max-w-xl text-body text-slate-600">
          كورسات وحصص مسجلة وامتحانات تدريبية — كل حاجة في مكان واحد.
          سجل من هنا وهتبعتلك بيانات الدخول على واتساب.
        </p>
        <a href="#" className="btn-primary mt-8 inline-flex">سجّل في مجموعة جديدة</a>

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
