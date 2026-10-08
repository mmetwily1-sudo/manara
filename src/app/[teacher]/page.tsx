import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentRegisterForm } from "@/components/StudentRegisterForm";
import { PhoneLoginForm } from "@/components/PhoneLoginForm";
import { StudentPinLogin } from "@/components/StudentPinLogin";
import { SiteSections } from "@/components/SiteSections";
import { resolveTheme } from "@/lib/site-themes";

/**
 * صفحة المعلم العامة — Programmatic SEO
 * على الدومين الحقيقي بتشتغل تحت subdomain المعلم عبر middleware rewrite.
 * في وضع التصدير الثابت (GitHub Pages preview) بتتبني كصفحات ثابتة معروفة.
 */

type Props = { params: { teacher: string } };

// Pre-render فقط للـdemo وقت البناء — أي slug/دومين آخر يُبنى ديناميكياً عند أول زيارة
// (dynamicParams=true تحت) ثم يُخزَّن مؤقتاً حسب revalidate. هذا ليس قيداً على
// عدد السناتر المدعومة، فقط اختيار أداء لقائمة البناء المسبق.
const PRERENDER_AT_BUILD = ["demo"];

export function generateStaticParams() {
  return PRERENDER_AT_BUILD.map((teacher) => ({ teacher }));
}

/**
 * يبحث عن tenant بالـslug أولاً، وإن لم يوجد وكان المعرّف يشبه دومين (فيه نقطة)
 * يبحث بـcustom_domain — هذا ما يجعل الدومين المخصص يعمل فعلياً (كان العمود
 * موجوداً في schema.sql بلا أي استهلاك في الكود قبل هذا الإصلاح).
 * استعلامان منفصلان بدل .or() لتفادي حقن فلتر PostgREST عبر معرّف مُدخَل من الـURL.
 */
async function findTenantByIdentifier(admin: any, identifier: string, select: string): Promise<any | null> {
  const { data: bySlug } = await admin.from("tenants").select(select).eq("slug", identifier).maybeSingle();
  if (bySlug) return bySlug;
  if (identifier.includes(".")) {
    const { data: byDomain } = await admin.from("tenants").select(select).eq("custom_domain", identifier).maybeSingle();
    if (byDomain) return byDomain;
  }
  return null;
}

export const dynamicParams = true;
export const revalidate = 60; // مواقع السناتر تتحدث باستمرار (ثيم/أقسام) — تحديث كل دقيقة

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeURIComponent(params.teacher);
  let titleName = slug;
  let desc = `كورسات ومجموعات وحصص مسجلة مع ${slug} — سجل ابني في مجموعة الآن.`;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const data = await findTenantByIdentifier(admin, slug, "name,settings");
      if (data?.name) titleName = data.name;
      const s = (data as any)?.settings ?? {};
      if (s.site_title) titleName = String(s.site_title);
      if (s.site_desc) desc = String(s.site_desc);
    }
  } catch {}
  return {
    title: `${titleName} — منصة تعليمية على منارة`,
    description: desc,
  };
}

export default async function TeacherPage({ params }: Props) {
  const slug = decodeURIComponent(params.teacher);
  let displayName: string | null = null;
  let teacherPhone: string | undefined;
  let themeId: string = "default";
  let sitePrimary: string = "";
  let siteFont: string = "cairo";
  let siteAccent = "";
  let siteLogo = "";
  let siteTitle = "";
  let siteDesc = "";
  let tenantId: string | null = null;
  // على الدومين المخصص يكون params.teacher هو الدومين نفسه لا الـslug —
  // كل النماذج تتعامل بالـslug الحقيقي (pin-login/register/phone-code تبحث به).
  let resolvedSlug = slug;
  let siteSections: any[] = [];
  let siteCss = "";
  let siteJs = "";
  let tenantPlan = "trial";
  let sessions: any[] = [];
  let videos: any[] = [];
  let notes: any[] = [];
  let examsCount = 0;
  let groups: any[] = [];
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, key, { auth: { persistSession: false } });
      const data = await findTenantByIdentifier(admin, slug, "id,name,slug,plan,settings");
      if (data?.name) displayName = data.name;
      resolvedSlug = String((data as any)?.slug ?? slug);
      tenantPlan = String((data as any)?.plan ?? "trial");
      teacherPhone = (data as any)?.settings?.owner_phone;
      themeId = String((data as any)?.settings?.theme ?? "default");
      sitePrimary = String((data as any)?.settings?.site_primary ?? "");
      siteFont = String((data as any)?.settings?.site_font ?? "cairo");
      const _s = (data as any)?.settings ?? {};
      if (/^#[0-9a-fA-F]{6}$/.test(String(_s.site_accent ?? ""))) siteAccent = String(_s.site_accent);
      if (/^https:\/\//.test(String(_s.site_logo ?? ""))) siteLogo = String(_s.site_logo).slice(0, 500);
      siteTitle = String(_s.site_title ?? "").slice(0, 80);
      siteDesc = String(_s.site_desc ?? "").slice(0, 200);
      if (Array.isArray((data as any)?.settings?.site_sections)) siteSections = (data as any).settings.site_sections;
      siteCss = String((data as any)?.settings?.site_custom_css ?? "");
      siteJs = String((data as any)?.settings?.site_custom_js ?? "");
      tenantId = (data as any)?.id ?? null;
    }
    if (tenantId) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const today = new Date().toISOString().slice(0, 10);
      const [ss, vv, nn, ee, gg] = await Promise.all([
        admin.from("sessions").select("session_date,topic,groups(name)").eq("tenant_id", tenantId).gte("session_date", today).order("session_date").limit(6),
        admin.from("videos").select("title,duration_sec").eq("tenant_id", tenantId).eq("visibility", "free").order("created_at", { ascending: false }).limit(4),
        admin.from("notes").select("title,subject").eq("tenant_id", tenantId).eq("visibility", "public").order("created_at", { ascending: false }).limit(4),
        admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_published", true),
        admin.from("groups").select("id,name").eq("tenant_id", tenantId).order("created_at").limit(8),
      ]);
      sessions = (ss.data ?? []) as any[];
      videos = (vv.data ?? []) as any[];
      notes = (nn.data ?? []) as any[];
      examsCount = ee.count ?? 0;
      groups = (gg.data ?? []) as any[];
    }
  } catch {}
  if (!displayName) notFound();
  const headerName = displayName.startsWith("سنتر") ? displayName : `أ. ${displayName}`;
  const heroName = displayName;

  const { def: th } = resolveTheme(themeId);
  const accent = /^#[0-9a-fA-F]{6}$/.test(sitePrimary) ? sitePrimary : th.primary;
  const hasCustomHtml = siteSections.some((s: any) => s?.type === "custom_html" && s?.visible !== false && String(s?.data?.html ?? "").trim() !== "");
  const customHtml = siteSections
    .filter((s: any) => s?.type === "custom_html" && s?.visible !== false)
    .map((s: any) => String(s?.data?.html ?? "").slice(0, 5000))
    .join("\n");
  const fontFamily =
    siteFont === "readex" ? "'Readex Pro', Cairo, sans-serif" :
    siteFont === "plex" ? "'IBM Plex Sans Arabic', Cairo, sans-serif" :
    "Cairo, sans-serif";
  const fontLink =
    siteFont === "readex" ? "https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap" :
    siteFont === "plex" ? "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" : null;
  return (
    <main className={th.main} style={{ fontFamily }}>
      {fontLink && <link href={fontLink} rel="stylesheet" />}
      <header className={th.header}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 text-h2 font-extrabold" style={{ color: accent }}>
            {siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : null}
            {headerName}
          </span>
          <Link href="/login" className="btn-secondary !px-4 !py-2 text-small">دخول الطلاب</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-display">منصة {heroName} التعليمية</h1>
        <p className="mx-auto mt-4 max-w-xl text-body text-slate-600">
          الحصص والفيديوهات والمذكرات والامتحانات — تصفح بحرية، وسجل عندما تقرر الانضمام.
        </p>

        {(sessions.length > 0 || videos.length > 0 || notes.length > 0 || examsCount > 0) ? (
          <div className="mt-14 space-y-8 text-right">
            {sessions.length > 0 && (
              <div>
                <h2 className="mb-3 font-extrabold">🗓️ الحصص القادمة</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sessions.map((s, i) => (
                    <div key={i} className={th.card}>
                      <div className="font-bold">{(s.groups as any)?.name ?? "حصة"}</div>
                      <div className="mt-1 text-small opacity-70" dir="ltr">{String(s.session_date ?? "").slice(0, 10)}</div>
                      {s.topic && <div className="mt-1 text-small opacity-70">{s.topic}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {videos.length > 0 && (
              <div>
                <h2 className="mb-3 font-extrabold">🎬 حصص مجانية</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {videos.map((v, i) => (
                    <div key={i} className={th.card}><div className="font-bold">{v.title}</div></div>
                  ))}
                </div>
              </div>
            )}
            {notes.length > 0 && (
              <div>
                <h2 className="mb-3 font-extrabold">📚 مذكرات</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {notes.map((n, i) => (
                    <div key={i} className={th.card}>
                      <div className="font-bold">{n.title}</div>
                      {n.subject && <div className="mt-1 text-small opacity-70">{n.subject}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {examsCount > 0 && (
              <p className="text-center text-small font-bold opacity-70">📝 {examsCount} امتحان تدريبي متاح لطلاب السنتر</p>
            )}
          </div>
        ) : (
          <div className={`mx-auto mt-10 max-w-xl ${th.card}`}>
            <div className="text-3xl">🎓</div>
            <p className="mt-2 font-bold">المحتوى يُجهز الآن — الحصص والفيديوهات والمذكرات ستظهر هنا أولاً بأول</p>
            <p className="mt-1 text-small opacity-70">سجل بياناتك بالأسفل ليصلك كل جديد وتدخل الامتحانات الأونلاين</p>
          </div>
        )}

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[["🎬", "حصص مسجلة", "شاهدها في أي وقت من موبايلك"],
            ["📝", "امتحانات تدريبية", "بتتصحح فوراً ودرجتك توصلك"],
            ["🎓", "شهادات إتمام", "بتتولد لوحدها وتشاركها"]].map(([i, t, d]) => (
            <div key={t} className={th.card}><div className="text-3xl">{i}</div><h2 className="mt-2 font-bold">{t}</h2><p className="mt-1 text-small opacity-70">{d}</p></div>
          ))}
        </div>

        <SiteSections sections={siteSections as any} card={th.card} accent={/^#[0-9a-fA-F]{6}$/.test(siteAccent) ? siteAccent : accent} />

        {groups.length > 0 && (
          <div className="mt-14 text-right">
            <h2 className="mb-3 text-center font-extrabold">📚 المواد والمجموعات</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {groups.map((g: any) => (
                <div key={g.id} className={th.card}>
                  <div className="text-2xl">📖</div>
                  <div className="mt-1 font-bold">{g.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-14" id="join">
          <h2 className="font-extrabold">📝 سجل بياناتك وانضم</h2>
          <p className="mt-1 text-small opacity-70">سيتم إنشاء حسابك فوراً — بيانات الدخول ستظهر لك على الشاشة.</p>
          <StudentRegisterForm slug={resolvedSlug} teacherPhone={teacherPhone} />
          <StudentPinLogin slug={resolvedSlug} />
          <PhoneLoginForm slug={resolvedSlug} />
        </div>

        {!!(siteCss || siteJs || hasCustomHtml) && (
          <iframe
            title="محتوى مخصص"
            sandbox="allow-scripts"
            srcDoc={`<style>${siteCss.slice(0, 10000)}</style>${customHtml}<div id="root"></div><script>${siteJs.slice(0, 10000)}<\/script>`}
            className="mt-8 w-full rounded-2xl border border-slate-200 bg-white"
            style={{ height: 420 }}
          />
        )}
      </section>

      <footer className="border-t border-slate-100 bg-white py-6 pb-24 text-center text-xs text-slate-400 sm:pb-6">
        مدعوم بمنارة —{" "}
        <Link href="/" className="underline">اعمل منصتك الخاصة</Link>
      </footer>

      {/* زر التسجيل الثابت للموبايل (قرار المجلس) */}
      <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <a href="#join" className="btn-primary block w-full !py-3 text-center shadow-xl">
          سجل الآن مجاناً 🚀
        </a>
      </div>
    </main>
  );
}
