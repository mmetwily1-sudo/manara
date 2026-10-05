import { createClient } from "@supabase/supabase-js";
import { DesignForm } from "@/components/DesignForm";

/** قسم تصميم المالك: لون لوحة الإدارة + قفل تخصيص السناتر (منفصل تماماً عن قسم المعلم). */
export default async function AdminDesignPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let design: any = { admin_accent: "", lock_tenant_design: false };
  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin.from("platform_settings").select("value").eq("key", "design").single();
    if ((data as any)?.value) design = { admin_accent: "", lock_tenant_design: false, ...(data as any).value };
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-h1">تصميم المنصة 🎨</h1>
        <p className="mt-1 text-small text-slate-500">هوية لوحة الإدارة + التحكم بتخصيص مواقع السناتر — لا يمسه أي معلم.</p>
      </div>
      <section className="card space-y-4 p-6">
        <DesignForm initial={design} />
      </section>
      <section className="card space-y-2 p-6 text-small text-slate-500">
        <p>• لون لوحة الإدارة يظهر في شعار الشريط وشعار القائمة فور الحفظ.</p>
        <p>• القفل يمنع كل السناتر من تغيير ثيماتها (يبقى الثيم الحالي) حتى تفتحه.</p>
        <p>• لإعادة ثيم سنتر معين: صفحة السناتر ← زر 🎨 افتراضي.</p>
      </section>
    </div>
  );
}
