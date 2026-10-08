import { PasskeyManager } from "@/components/PasskeyManager";
import { TotpManager } from "@/components/TotpManager";
import { DevicesManager } from "@/components/DevicesManager";
import { SecurityAlerts } from "@/components/SecurityAlerts";
import { KeysManager } from "@/components/KeysManager";
import { FeaturesManager } from "@/components/FeaturesManager";
import { BrandingManager } from "@/components/BrandingManager";
import { CustomDomainManager } from "@/components/CustomDomainManager";
import { PagesManager } from "@/components/PagesManager";
import { NotifyRulesManager } from "@/components/NotifyRulesManager";
import { NotifyToggle, PayNumbersForm, VisionKeyForm, ThemeForm, SlugForm } from "@/components/NotifyToggle";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";
import { getTenantInfoDB } from "@/lib/data";

export default async function SettingsPage() {
  const t = await getTenantInfoDB();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-h1">هويتي والإعدادات</h1>
        <p className="mt-1 text-small text-slate-500">بيانات سنترك وإعدادات الدخول السريع</p>
      </header>

      <section className="card p-6">
        <h2 className="font-bold">بيانات السنتر</h2>
        <dl className="mt-4 space-y-3 text-small">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">الاسم</dt>
            <dd className="font-bold">{t.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">الرابط</dt>
            <dd className="font-mono text-xs font-bold" dir="ltr">{t.slug}.manara.app</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">موقعك العام</dt>
            <dd>
              <a href={`/${t.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white">
                عرض موقعي 🌐
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">الباقة</dt>
            <dd className="font-bold">{t.plan}</dd>
          </div>
        </dl>
      </section>

      <section className="card space-y-4 p-6">
        <NotifyToggle />
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-bold">إشعارات الجهاز 🔔</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            تنبيهات الغياب والنتائج والمدفوعات على هذا الجهاز — حتى لو التطبيق مقفول.
          </p>
        </div>
        <PushSubscribeButton />
      </section>

      <section className="card space-y-4 p-6">
        <PayNumbersForm />
      </section>

      <section className="card space-y-4 p-6">
        <VisionKeyForm />
      </section>

      <section className="card space-y-4 p-6">
        <ThemeForm />
      </section>

      <section className="card space-y-4 p-6">
        <SlugForm current={t.slug} />
      </section>

      <section className="card space-y-4 p-6">
        <TotpManager />
      </section>

      <section className="card space-y-4 p-6">
        <DevicesManager />
      </section>

      <section className="card space-y-4 p-6">
        <SecurityAlerts />
      </section>

      <section className="card space-y-4 p-6">
        <KeysManager />
      </section>

      <section className="card space-y-4 p-6">
        <FeaturesManager />
      </section>

      <section className="card space-y-4 p-6">
        <BrandingManager />
      </section>

      <section className="card space-y-4 p-6">
        <CustomDomainManager />
      </section>

      <section className="card space-y-4 p-6">
        <PagesManager />
      </section>

      <section className="card space-y-4 p-6">
        <NotifyRulesManager />
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-bold">الدخول السريع بالبصمة / الوجه 👆</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            فعّلها مرة واحدة من جهازك، وبعدها ستدخل ببصمة إصبعك أو وجهك
            بدون كتابة كلمة السر — على نفس الجهاز.
          </p>
        </div>
        <PasskeyManager />
      </section>
    </div>
  );
}
