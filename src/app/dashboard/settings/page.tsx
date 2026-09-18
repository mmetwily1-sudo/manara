import { PasskeyManager } from "@/components/PasskeyManager";
import { NotifyToggle } from "@/components/NotifyToggle";
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
