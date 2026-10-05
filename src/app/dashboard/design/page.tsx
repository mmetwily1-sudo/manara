import { SiteDesigner } from "@/components/SiteDesigner";
import { SiteBuilder } from "@/components/SiteBuilder";
import { getTenantInfoDB } from "@/lib/data";

/** قسم تصميم الموقع — منفصل بذاته: ثيم السنتر + اللون + الخط + معاينة حية. */
export default async function DesignPage() {
  const t = await getTenantInfoDB();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">تصميم الموقع 🎨</h1>
        <p className="mt-1 text-small text-slate-500">هوية موقع سنترك العام — التغيير يظهر لزوارك فوراً.</p>
      </header>
      <section className="card space-y-4 p-6">
        <SiteDesigner slug={t.slug} />
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">🧱 منشئ الأقسام</h2>
        <p className="text-xs text-slate-500">بنرات، عدّاد، آراء، أسئلة، معرض، وكود مخصص — تُعرض فوق التسجيل مباشرة.</p>
        <SiteBuilder slug={t.slug} />
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">📱 معاينة حية (موبايل)</h2>
        <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-white shadow-xl">
          <iframe src={`/${t.slug}`} title="معاينة الموقع" className="h-[560px] w-full" loading="lazy" />
        </div>
        <p className="text-center text-xs text-slate-400">تحدث المعاينة مع كل حفظ (حدّث بتغيير بسيط إن لزم).</p>
      </section>
    </div>
  );
}
