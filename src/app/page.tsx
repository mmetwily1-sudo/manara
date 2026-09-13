import Link from "next/link";

const tools = [
  { n: "01", title: "تحضير في ثواني", desc: "QR بكاميرا الموبايل أو ضغطة واحدة على شاشة المجموعة — وشغال حتى لو النت قطع" },
  { n: "02", title: "تحصيل بصفر عمولة", desc: "كاش أو انستاباي، دفع كامل أو جزئي، إيصال فوري، وتقفيل خزنة يومي بيحسب العجز لوحده" },
  { n: "03", title: "إشعارات أولياء الأمور", desc: "ابنك غايب؟ ولي الأمر يعرف لحظتها — من غير واتساب API ومن غير رقم شغل منفصل" },
  { n: "04", title: "امتحانات بتتصحح لوحدها", desc: "اعمل امتحان من بنك أسئلتك بمستويات مختلفة بضغطة زرار — 200 طالب في أقل من 10 دقايق" },
  { n: "05", title: "فيديوهات محمية", desc: "حصصك المسجلة بمشغل محمي وعلامة باسم الطالب — محدش ينزلها وينشرها" },
  { n: "06", title: "شهادات تلقائية", desc: "الطالب يخلص امتحان؟ الشهادة تتولد لوحدها برمز تحقق — ويشاركها وإعلان مجاني ليك" },
  { n: "07", title: "جدول شهري للمجموعات", desc: "جدول أسبوعي ثابت يتولد لوحده، وتعارضات القاعات تتنبه قبل ما تحصل" },
  { n: "08", title: "منتدى ومجموعات", desc: "رسائل وصوتيات وملفات لمجموعتك — بدل فوضى جروبات الواتساب" },
  { n: "09", title: "إنذار مبكر", desc: "الطالب اللي حضوره أو درجاته بتنزل — قدامك قبل ما يسيب السنتر خالص" },
  { n: "10", title: "هويتك الكاملة", desc: "اسمك ولونك ولوجوك على كل حاجة: التطبيق والشهادات والإيصالات وأوراق الامتحانات" },
];

const before = [
  "طابور 40 طالب عند الباب ونداء بالأسامي",
  "متأخرات 3 شهور محدش واخد باله منها",
  "مكالمات مالهاش آخر: «ابني وصل؟» «دفعنا ولا لأ؟»",
  "خزنة آخر اليوم «تقريباً» مظبوطة",
];
const after = [
  "تحضير 200 طالب في 3 دقايق — والإشعارات بتتبعت لوحدها",
  "المتأخرات بالاسم والمبلغ — وتذكير جاهز بضغطة",
  "الأهل شايفين بنفسهم في بوابة خاصة — وبطّلوا يتصلوا",
  "الخزنة بتتقفل بالجرد — والفرق بالجنيه موثق باسم صاحبه",
];

const faqs = [
  { q: "برنامج إدارة السنتر بكام؟", a: "باقاتنا تبدأ من 450 جنيه شهرياً للمعلم الفردي و750 للباقة الاحترافية الكاملة، مع شهرين مجاناً عند الاشتراك السنوي. جرّب 7 أيام مجاناً الأول بدون أي بطاقة." },
  { q: "فيه عمولة على الفلوس اللي بحصلها؟", a: "لأ نهائياً. صفر عمولة — فلوسك توصلك كاملة سواء كاش أو تحويل إلكتروني." },
  { q: "محتاج واتساب API ولا رقم شغل تاني؟", a: "لأ. الإشعارات بتوصل أولياء الأمور من داخل التطبيق مباشرة حتى وهو مقفول، ورقمك الشخصي يفضل شخصي. ولو حبيت تبعت واتساب — الرسالة جاهزة بضغطة من رقمك إنت." },
  { q: "لو النت قطع في السنتر؟", a: "التحضير شغال عادي — بيتسجل محلياً وبيتبعت تلقائياً لما النت يرجع. وأي عملية فلوس بتاخد تأكيد السيرفر عشان خزنتك تفضل مظبوطة بالجنيه — ده قرار أمان مقصود." },
  { q: "بيانات طلابي آمنة؟", a: "كل سنتر بياناته معزولة تماماً على مستوى قاعدة البيانات نفسها — مش مجرد إخفاء أزرار. ونسخ احتياطي يومي، وبياناتك ليك وبتتصدر في أي وقت حتى لو وقفت اشتراكك." },
  { q: "إزاي أولياء الأمور يدخلوا؟", a: "إنت اللي بتفتح الحساب من عندك وتبعت البيانات برقمه — محدش يشوف بيانات ابنك غيره. ولي الأمر يتابع الحضور والدرجات والدفع لحظة بلحظة." },
  { q: "يصلح للمدرس الفردي ولا للسنتر بس؟", a: "الاتنين. المعلم الفردي بيدير طلابه وفلوسه وامتحاناته من غير سكرتارية، والسنتر بيضيف طاقم بصلاحيات مفصلة — مين يشوف الفلوس ومين يحضر ومين يدخل درجات." },
  { q: "إيه طرق الدفع؟", a: "فودافون كاش، إنستاباي، فوري، أو بطاقة بنكية." },
];

export default function HomePage() {
  return (
    <main>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-extrabold text-primary">منارة</Link>
          <nav className="hidden items-center gap-8 text-small font-semibold text-slate-600 md:flex">
            <a href="#tools" className="transition hover:text-primary">الميزات</a>
            <a href="#how" className="transition hover:text-primary">إزاي بيشتغل</a>
            <Link href="/pricing" className="transition hover:text-primary">الأسعار</Link>
            <a href="#faq" className="transition hover:text-primary">أسئلة شائعة</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden font-bold text-slate-600 transition hover:text-primary md:block">الدخول</Link>
            <Link href="/join" className="btn-primary !px-5 !py-2 text-small">ابدأ مجاناً</Link>
          </div>
        </div>
      </header>

      {/* Hero — split غير متناظر (RTL: النص يمين، المنتج شمال) */}
      <section className="overflow-hidden px-4 pb-20 pt-14 md:pt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="rise rise-1 max-w-xl text-h1 leading-snug md:text-display md:leading-tight">
              سيب تشغيل سنترك علينا.
              <span className="block mt-2 text-primary">حضّر، حصّل، وامتحن — باسمك أنت.</span>
            </h1>
            <p className="rise rise-2 mt-6 max-w-lg text-body leading-relaxed text-slate-600">
              منصة كاملة بهوية سنترك: تحضير بالـQR، إشعارات أولياء الأمور لحظياً،
              وامتحانات بتتصحح لوحدها.
            </p>
            <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-4">
              <Link href="/join" className="btn-primary">ابدأ مجاناً</Link>
              <Link href="/pricing" className="btn-secondary">شوف الأسعار</Link>
            </div>
            <p className="rise rise-4 mt-5 text-small text-slate-400">
              7 أيام تجربة كاملة · بدون بطاقة ائتمان
            </p>
          </div>

          <div className="bezel rise rise-3">
            <div className="bezel-core p-5">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-small font-bold">سنتر النور · التحضير</span>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">شغّال الآن</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-success/10 p-4"><div className="text-3xl font-extrabold text-success">38</div><div className="mt-1 text-xs text-slate-500">حاضر</div></div>
                <div className="rounded-xl bg-danger/5 p-4"><div className="text-3xl font-extrabold text-danger/80">2</div><div className="mt-1 text-xs text-slate-500">غايب</div></div>
                <div className="rounded-xl bg-primary-light p-4"><div className="text-3xl font-extrabold text-primary">12,400</div><div className="mt-1 text-xs text-slate-500">محصّل الشهر ده</div></div>
              </div>
              <div className="mt-4 space-y-2">
                {[["يوسف حسن", "QR · 4:02"], ["مريم عادل", "كود · 4:04"], ["سارة علي", "— غايب"]].map(([n, s]) => (
                  <div key={n} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-small">
                    <span className="font-semibold">{n}</span>
                    <span className={s.includes("غايب") ? "text-danger" : "text-success"}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-primary/10 bg-primary-light/60 p-3 text-small leading-relaxed text-slate-700">
                «ابنك وصل السنتر ✓ الساعة 4:02» — وصلت لولي الأمر تلقائياً
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip — مستقلة تحت الهيرو (مش جواه) */}
      <section className="border-y border-slate-100 bg-white px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-2 text-small font-semibold text-slate-500">
          <span>صفر عمولة على التحصيل</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span>بدون بطاقة ائتمان</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span>بياناتك ليك وبتتصدر أي وقت</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span>ضمان استرداد 7 أيام</span>
        </div>
      </section>

      <section id="how" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="section-title">قبل منارة.. وبعد منارة</h2>
          <p className="section-sub">الفرق في يومك مش في الكلام — في الأرقام.</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-8">
              <h3 className="mb-6 inline-block rounded-full bg-danger/5 px-4 py-1.5 text-small font-bold text-danger">قبل منارة</h3>
              <ul className="space-y-4">
                {before.map((x) => (
                  <li key={x} className="flex items-start gap-3 text-body text-slate-500">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger/10 text-xs font-bold text-danger">✕</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card border-success/15 p-8">
              <h3 className="mb-6 inline-block rounded-full bg-success/10 px-4 py-1.5 text-small font-bold text-success">بعد منارة</h3>
              <ul className="space-y-4">
                {after.map((x) => (
                  <li key={x} className="flex items-start gap-3 text-body font-medium">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-bold text-success">✓</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="tools" className="bg-white px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="section-title">عشر أدوات في تطبيق واحد</h2>
          <p className="section-sub">كل حاجة بتلمسها في يومك موجودة وشغالة مع بعضها — من غير ما تنقل رقم بإيدك.</p>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <article key={t.n} className="group border-t-2 border-slate-100 pt-6 transition hover:border-primary">
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-primary">{t.n}</span>
                  <h3 className="font-bold transition group-hover:text-primary">{t.title}</h3>
                </div>
                <p className="text-small leading-relaxed text-slate-600">{t.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="notifications" className="px-4 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h2 className="max-w-md text-h1 leading-snug md:text-display md:leading-tight">
              مش محتاج واتساب API. ولا رقم شغل تاني.
            </h2>
            <p className="mt-5 max-w-lg text-body leading-relaxed text-slate-600">
              الإشعار بيوصله موبايل ولي الأمر من المنصة مباشرة — حتى والتطبيق مقفول تماماً.
            </p>
            <ul className="mt-8 space-y-4">
              {[["الحضور والانصراف بيوصلا لوحدهم", "ثانية ما السكرتيرة تمسح الكارت"],
                ["ولي الأمر بيرد جوه التطبيق", "محادثة خاصة بيه — ومحدش يشوف رد التاني"],
                ["والواتساب موجود لو حبيت", "أي رسالة تتفتح كشات جاهز بضغطة من رقمك"]].map(([t, d]) => (
                <li key={t} className="border-r-2 border-primary/20 pr-4">
                  <div className="font-bold">{t}</div>
                  <div className="mt-0.5 text-small text-slate-500">{d}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bezel">
            <div className="bezel-core space-y-3 p-5">
              {[["وصل السنتر ✓", "يوسف حسن وصل الساعة 4:02 م", "دلوقتي"],
                ["درجة امتحان جديدة", "فيزياء — الوحدة التالتة: 27 من 30", "قبل دقيقتين"],
                ["رسالة من المدرّس", "مراجعة السبت الساعة 4 — الحضور مهم", "قبل 5 دقايق"]].map(([t, b, time]) => (
                <div key={t} className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4">
                  <div>
                    <div className="text-small font-bold">{t}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{b}</div>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-slate-400">{time}</span>
                </div>
              ))}
              <div className="pt-1 text-center text-xs text-slate-400">التطبيق مقفول — والإشعار وصل</div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-24 text-center">
        <h2 className="section-title">سعر واحد واضح — من غير مفاجآت</h2>
        <p className="section-sub">
          تبدأ من 450 جنيه في الشهر. والسنوي فيه شهرين مجاناً.
          وسعرك ثابت ما دمت مشترك — مهما زادت أسعارنا بعدين.
        </p>
        <Link href="/pricing" className="btn-primary">شوف الباقات</Link>
      </section>

      <section id="faq" className="bg-white px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-title">كل اللي محتاج تعرفه</h2>
          <div className="divide-y divide-slate-100 border-y border-slate-100">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold transition group-open:text-primary">
                  {f.q}
                  <span className="shrink-0 text-h2 font-normal text-slate-300 transition group-open:hidden">+</span>
                  <span className="hidden shrink-0 text-h2 font-normal text-primary group-open:block">−</span>
                </summary>
                <p className="mt-3 max-w-[65ch] text-body leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-28 text-center">
        <h2 className="mx-auto max-w-2xl text-h1 leading-snug md:text-display md:leading-tight">
          كل يوم بيعدي من غير منارة — وقت وفلوس مش هترجعوا
        </h2>
        <p className="section-sub mt-4">جرّب 7 أيام على بياناتك الحقيقية. ولو محتاج حد يجهزلك كل حاجة — كلمنا وهنعملها بإيدينا.</p>
        <Link href="/join" className="btn-primary text-lg">ابدأ مجاناً</Link>
      </section>

      <footer className="border-t border-slate-100 bg-white px-4 py-12 text-center text-small text-slate-500">
        <div className="mb-3 text-xl font-extrabold text-primary">منارة</div>
        <p>نظام تشغيل المعلم والسنتر — صنع في مصر 🇪🇬</p>
        <div className="mt-5 flex justify-center gap-8">
          <Link href="/privacy" className="transition hover:text-primary">الخصوصية</Link>
          <Link href="/terms" className="transition hover:text-primary">الشروط</Link>
        </div>
      </footer>


    </main>
  );
}
