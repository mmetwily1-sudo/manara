import Link from "next/link";
import type { Metadata } from "next";
import { PayOnlineButton } from "@/components/PayOnlineButton";

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

export default function PricingPage() {
  return (
    <main className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="section-title">أسعار واضحة — من غير مفاجآت</h1>
        <p className="section-sub">
          جرّب 14 يوم مجاناً بدون بطاقة. والاشتراك السنوي فيه شهرين مجاناً.
          <strong> وسعرك ثابت ما دمت مشترك</strong> — مهما زادت أسعارنا بعدين، حسابك مش هيتمسّ.
        </p>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`card relative flex flex-col ${p.highlight ? "border-2 border-primary shadow-lg" : ""}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 right-6 rounded-full bg-primary px-4 py-1 text-xs font-bold text-white">
                  الأكثر اختياراً ⭐
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
                  <li key={f} className="flex gap-2">✓ <span>{f}</span></li>
                ))}
              </ul>
              <Link href="/join" className={p.highlight ? "btn-primary w-full" : "btn-secondary w-full"}>
                {p.cta}
              </Link>
              <PayOnlineButton plan={p.monthly === 450 ? "starter" : p.monthly === 750 ? "pro" : "scale"} />
            </div>
          ))}
        </div>

        <div className="card mx-auto mt-10 max-w-3xl bg-surface">
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
