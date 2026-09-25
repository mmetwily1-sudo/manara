import Link from "next/link";

export const metadata = {
  title: "رشّح زميلك واكسبا معاً — منارة",
  description: "كل معلم يسجّل بدعوتك ويدفع تكسب أنت أياماً وهو أيام. عرض الافتتاح: 14 يوماً بدل 7 حتى نهاية أكتوبر.",
};

/** صفحة هبوط الإحالة: مكافأة الطرفين + عرض الافتتاح + خطوات */
export default function ReferralLanding() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="text-center">
        <div className="text-5xl">🎁</div>
        <h1 className="mt-3 text-h1">رشّح زميلاً… واكسبا معاً</h1>
        <p className="mx-auto mt-2 max-w-xl text-body text-slate-600">
          كل زميل يسجّل برابطك ويدفع أول اشتراك، تكسب <b>أنت 7 أيام</b> وهو <b>7 أيام</b> —
          وفي عرض الافتتاح (حتى نهاية أكتوبر) مكافأتك <b>14 يوماً</b>.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/join" className="btn-primary">ابدأ تجربتك المجانية</Link>
          <a href="#how" className="btn-secondary">كيف تعمل؟</a>
        </div>
      </header>

      <section id="how" className="grid gap-4 sm:grid-cols-3">
        {[
          ["1️⃣", "انسخ رابطك", "من بطاقة الإحالة في لوحة تحكمك بضغطة واحدة."],
          ["2️⃣", "زميلك يسجّل ويدفع", "لا تُحتسب الإحالة بالتسجيل فقط — بل بأول اشتراك حقيقي."],
          ["3️⃣", "تكسبا معاً", "أيامك تُضاف تلقائياً بعد فترة الحماية (14 يوماً)، وهو يكسب 7 أيام."],
        ].map(([e, t, d]) => (
          <div key={t} className="card space-y-2 p-5 text-center">
            <div className="text-3xl">{e}</div>
            <div className="font-bold">{t}</div>
            <p className="text-small text-slate-500">{d}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-3 border-success/25 bg-success/5 p-6">
        <h2 className="font-bold">🛡️ ضد التحايل — بعدل للجميع</h2>
        <ul className="space-y-1.5 text-small text-slate-600">
          <li>• لا مكافأة على الحسابات الوهمية: الاستحقاق بعد أول دفعة حقيقية فقط.</li>
          <li>• ممنوع الإحالة الذاتية، وكل زميل يُحتسب مرة واحدة.</li>
          <li>• سقف عادل: 5 مكافآت شهرياً و20 سنوياً لكل معلم.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">الأسئلة الشائعة</h2>
        {[
          ["متى تصلني الأيام؟", "بعد أول اشتراك مدفوع لزميلك + 14 يوم حماية من الاسترداد — تُضاف تلقائياً لاشتراكك."],
          ["وهو يكسب إيه؟", "7 أيام اشتراك مجانية تضاف له أول مرة — لذلك يقبل الدعوة بحماس."],
          ["فيه حد؟", "5 شهرياً و20 سنوياً — كفاية لأكثر المعلمين نشاطاً."],
          ["عرض الافتتاح؟", "حتى نهاية أكتوبر: مكافأتك 14 يوماً بدل 7 على كل إحالة مؤهلة."],
        ].map(([q, a]) => (
          <details key={q} className="card px-5 py-3">
            <summary className="cursor-pointer text-small font-bold">{q}</summary>
            <p className="mt-2 text-small text-slate-600">{a}</p>
          </details>
        ))}
      </section>

      <div className="card bg-slate-900 p-8 text-center text-white">
        <div className="text-h1 font-extrabold">معلمون يكبرون معاً 🤝</div>
        <p className="mx-auto mt-2 max-w-md text-small text-slate-300">ابدأ تجربتك المجانية (14 يوماً) — ورابط إحالتك بانتظارك في اللوحة من أول يوم.</p>
        <Link href="/join" className="btn-primary mt-4 inline-block !bg-white !text-slate-900">ابدأ الآن مجاناً</Link>
      </div>
    </main>
  );
}
