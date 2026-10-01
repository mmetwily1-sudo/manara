import Link from "next/link";
import type { Metadata } from "next";
import { PayOnlineButton } from "@/components/PayOnlineButton";
import Testimonials from "@/components/Testimonials";

export const metadata: Metadata = {
  title: "الأسعار — منارة",
  description:
    "باقات منارة: أساسي 450 ج/شهر للمعلم الفردي، احترافي 750 ج بالفيديو والامتحانات والهوية البيضاء، سنتر بلس 1,500 ج. السنوي فيه شهرين مجاناً وسعرك ثابت ما دمت مشترك.",
};

const plans = [
  {
    name: "أساسي",
    tagline: "للمدرس الفردي اللي عايز ينتظم",
    monthly: 450,
    yearly: 4500,
    limit: "حتى 150 طالب",
    features: [
      "تحضير QR ويدوي + أوفلاين",
      "تحصيل وإيصالات وتقفيل خزنة",
      "إشعارات أولياء الأمور",
      "بوابة ولي الأمر",
      "واجبات ومجموعات وجدول شهري",
      "تقارير PDF بهويتك",
    ],
    cta: "ابدأ التجربة المجانية",
    highlight: false,
  },
  {
    name: "احترافي",
    tagline: "الأكثر اختياراً — المنصة كاملة",
    monthly: 750,
    yearly: 7500,
    limit: "حتى 300 طالب",
    features: [
      "كل ميزات الأساسي",
      "فيديوهات محمية بـ Watermark",
      "بنك أسئلة وامتحانات آلية التصحيح",
      "شهادات تلقائية بـ QR تحقق",
      "منتدى ومجموعات وصوتيات",
      "هوية بيضاء كاملة + صفحة عامة باسمك",
      "مساعد ذكي بيقرأ بياناتك",
    ],
    cta: "ابدأ التجربة المجانية",
    highlight: true,
  },
  {
    name: "سنتر بلس",
    tagline: "للسناتر وطاقم العمل",
    monthly: 1500,
    yearly: 15000,
    limit: "حتى 500 طالب + فروع",
    features: [
      "كل ميزات الاحترافي",
      "طاقم غير محدود بصلاحيات مفصلة",
      "تطبيق APK باسم سنترك",
      "قفل الشاشات المالية وسجل النشاط",
      "تهيئة يدوية بإيدينا على الواتساب",
      "دعم فني بأولوية",
    ],
    cta: "ابدأ التجربة المجانية",
    highlight: false,
  },
];

export default function PricingPage({ searchParams }: { searchParams?: { plan?: string; expired?: string } }) {
  const want = (searchParams?.plan ?? "").toLowerCase();
  const planKey = (m: number) => (m === 450 ? "starter" : m === 750 ? "pro" : "scale");
  const picked = ["starter", "pro", "scale"].includes(want) ? want : null;
  const isReturn = searchParams?.expired === "1";
  return (
    <main className="relative overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl">
        <span className="eyebrow">💰 صفر عمولة على تحصيلك</span>
        <h1 className="mt-4 text-h1 md:text-display">أسعار واضحة — <span className="grad-text">من غير مفاجآت</span></h1>
        <p className="section-sub">
          جرّب 14 يوم مجاناً بدون بطاقة. والاشتراك السنوي فيه شهرين مجاناً.
          <strong> وسعرك ثابت ما دمت مشترك</strong> — مهما زادت أسعارنا بعدين، حسابك مش هيتمسّ.
        </p>
        {isReturn && (
          <div className="card mx-auto mb-8 max-w-3xl border-success/30 bg-success/5 p-5 text-center">
            <div className="font-bold text-success">🎉 رجعت في الوقت المناسب — سنترك وبياناتك محفوظة كما تركتها</div>
            <p className="mt-1 text-small text-slate-600">اختر باقتك وكمّل من حيث توقفت — وضمان الاسترداد 30 يوماً سارٍ.</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p) => {
            const hot = picked ? planKey(p.monthly) === picked : p.highlight;
            return (
            <div
              key={p.name}
              className={`card card-hover relative flex flex-col p-7 ${hot ? "border-2 border-primary shadow-[0_8px_30px_-6px_rgba(26,115,232,0.35)] lg:-translate-y-2" : ""}`}
            >
              {hot && (
                <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-l from-primary to-primary-dark px-4 py-1 text-xs font-bold text-white shadow-[0_8px_30px_-6px_rgba(26,115,232,0.35)]">
                  {picked ? "مختارة لعودتك ✅" : "الأكثر اختياراً ⭐"}
                </span>
              )}
              <h2 className="text-h2 font-extrabold">{p.name}</h2>
              <p className="mt-1 text-small text-slate-500">{p.tagline}</p>
              <div className="my-5">
                <span className="text-display font-extrabold text-primary">{p.monthly}</span>
                <span className="text-body text-slate-500"> ج/شهر</span>
                <div className="mt-1 text-small text-success font-semibold">
                  أو {p.yearly} ج/سنة — وفّر {p.monthly * 12 - p.yearly} جنيه
                </div>
              </div>
              <ul className="mb-8 flex-1 space-y-2.5 text-small">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-xs font-bold text-success">✓</span><span>{f}</span></li>
                ))}
              </ul>
              <Link href="/join" className={p.highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
                {p.cta}
              </Link>
              <PayOnlineButton plan={p.monthly === 450 ? "starter" : p.monthly === 750 ? "pro" : "scale"} />
            </div>
            );
          })}
        </div>

        <div className="h-20 sm:hidden" aria-hidden />
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <Link href="/join" className="btn-primary w-full">
            ابدأ مجاناً — 14 يوم 🚀
          </Link>
        </div>

        <div className="card mx-auto mt-10 max-w-3xl bg-surface p-6">
          <h2 className="mb-4 text-center text-h2">ضماناتنا المكتوبة</h2>
          <div className="grid gap-4 sm:grid-cols-3 text-center text-small">
            <div><div className="text-3xl">🛡️</div><b>ضمان استرداد 30 يوم</b><p className="mt-1 text-slate-600">مش عاجبك؟ فلوسك ترجعلك كاملة بدون أسئلة.</p></div>
            <div><div className="text-3xl">🔒</div><b>Price-Lock دائم</b><p className="mt-1 text-slate-600">سعرك ثابت ما دمت مشترك — مهما حصل في السوق.</p></div>
            <div><div className="text-3xl">📤</div><b>بياناتك ليك</b><p className="mt-1 text-slate-600">صدّر كل حاجة Excel في أي وقت — حتى لو وقفت اشتراكك.</p></div>
          </div>
        </div>

        <div className="card mx-auto mt-10 max-w-3xl bg-gradient-to-l from-primary-light/50 to-transparent p-6 text-center">
          <div className="text-3xl">🎁</div>
          <h2 className="mt-1 font-bold">عندك زميل معلم؟ اكسبا معاً 14 يوماً</h2>
          <p className="mx-auto mt-1 max-w-md text-small text-slate-600">كل إحالة مؤهلة = أيام مجانية لك وله — بلا حد أدنى وبلا عمولة.</p>
          <Link href="/referral" className="btn-primary mt-3 inline-block">اعرف عن برنامج الإحالة ←</Link>
        </div>

        <Testimonials />

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <h2 className="text-h2 mb-4">أسئلة عن الدفع</h2>
          <div className="space-y-3 text-right">
            {[
              ["فيه عمولة على الفلوس اللي بحصلها؟", "أبداً — صفر عمولة على تحصيلك مهما كان حجمه."],
              ["إيه طرق الدفع المتاحة؟", "فودافون كاش، إنستاباي، فوري، أو بطاقة بنكية."],
              ["لو وقفت اشتراكي بياناتي تروح؟", "لأ. بياناتك محفوظة لمدة سنة كاملة وممكن تصدرها في أي وقت — ورجوعك سهلة بضغطة."],
              ["ينفع أدفع بالشهر بس؟", "أيوة، الباقات شهرية مرنة — بس السنوي بتوفر شهرين كاملين."],
            ].map(([q, a]) => (
              <details key={q} className="group card !py-4">
                <summary className="cursor-pointer list-none font-bold group-open:text-primary">{q}</summary>
                <p className="mt-3 text-body text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
