import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CommandPalette } from "@/components/CommandPalette";

const MENU: [string, string, string][] = [
  ["/admin", "🏠", "نظرة عامة"],
  ["/admin/tenants", "🏫", "السناتر"],
  ["/admin/billing", "💰", "الفوترة"],
  ["/admin/impersonate", "👁️", "المتابعة"],
  ["/admin/feedback", "💬", "صوت المعلمين"],
  ["/admin/design", "🎨", "التصميم"],
  ["/admin/dev", "🛠️", "المطور"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) redirect("/login");

  const store = cookies();
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => { try { store.set(name, value, options); } catch {} }); },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("role").eq("auth_user_id", user.id).single();  // المالك ببريده (يحتفظ بدور المعلم في سنتره) + مديرو المنصة — القائمة من البيئة فقط
  const owners = (process.env.PLATFORM_OWNER_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isOwner = owners.includes((user.email ?? "").toLowerCase());
  if (urow?.role !== "platform_admin" && !isOwner) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-h1">🔒</div>
        <h1 className="text-h1">وصول مقيد</h1>
        <p className="text-small text-slate-500">هذه اللوحة لمسؤولي المنصة فقط — حسابك: {user.email}</p>
        <p className="text-xs text-slate-400">لمنح صلاحية: حدّث users.role إلى platform_admin في Supabase</p>
      </main>
    );
  }

  const { data: plat } = await admin.from("platform_settings").select("value").eq("key", "design").single().then(
    (r) => r,
    () => ({ data: null } as any)
  );
  const accent = /^#[0-9a-fA-F]{6}$/.test(String((plat as any)?.value?.admin_accent ?? "")) ? String((plat as any).value.admin_accent) : "#1A73E8";

  return (
    <div className="min-h-screen bg-slate-100">
      {/* الشريط العلوي — طراز ووردبريس */}
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between bg-slate-900 px-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-extrabold text-white" style={{ backgroundColor: accent }}>ن</span>
          <span className="font-bold">منارة</span>
          <Link href="/" target="_blank" rel="noreferrer" className="hidden text-xs text-slate-300 hover:text-white sm:inline">
            عرض الموقع ↗
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <CommandPalette />
          <span className="hidden text-slate-300 sm:inline">أهلاً، {(user.email ?? "").split("@")[0]}</span>
          <Link href="/dashboard" className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">لوحة المعلم</Link>
        </div>
      </header>

      <div className="flex">
        {/* القائمة الجانبية — يمين (RTL مثل ووردبريس العربي) */}
        <aside className="min-h-[calc(100vh-3rem)] w-16 shrink-0 bg-slate-900 text-slate-300 md:w-52">
          <nav className="space-y-1 p-2">
            {MENU.map(([href, icon, label]) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-small font-bold transition hover:bg-slate-800 hover:text-white">
                <span className="text-lg">{icon}</span>
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
