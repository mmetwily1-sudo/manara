import { createClient } from "@supabase/supabase-js";

export async function generateMetadata({ params }: { params: { tenant: string; page: string } }) {
  return { title: `${params.page} — منارة` };
}

/** صفحة سنتر مخصصة منشورة: /p/[tenant]/[page] */
export default async function TenantPublicPage({ params }: { params: { tenant: string; page: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let page: any = null;
  let brand: any = null;

  if (url && service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: t } = await admin.from("tenants").select("id,name,logo_url,primary_color")
      .eq("slug", params.tenant).eq("status", "active").single();
    if (t) {
      brand = t;
      const { data: p } = await admin.from("tenant_pages").select("title,body")
        .eq("tenant_id", (t as any).id).eq("slug", params.page).eq("published", true).single();
      page = p;
    }
  }

  if (!page) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-h1">📄</div>
        <h1 className="text-h1">الصفحة غير موجودة</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl min-h-screen p-6" dir="rtl">
      <header className="text-center">
        {brand?.logo_url && <img src={brand.logo_url} alt={brand.name} className="mx-auto mb-2 h-14 w-14 rounded-2xl object-cover" />}
        <div className="text-xs font-bold text-slate-400">{brand?.name}</div>
        <h1 className="mt-1 text-h1" style={{ color: brand?.primary_color || undefined }}>{page.title}</h1>
      </header>
      <article className="card mt-6 whitespace-pre-wrap p-6 leading-relaxed" dir="auto">{page.body}</article>
    </main>
  );
}
