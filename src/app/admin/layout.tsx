import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) redirect("/login");

  const store = cookies();
  const sb = createServerClient(url, anon, {
    cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: urow } = await admin.from("users").select("role").eq("auth_user_id", user.id).single();
  // المالك ببريده (يحتفظ بدور المعلم في سنتره) + مديرو المنصة — القائمة من البيئة فقط
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

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-slate-900 px-4 text-white">
        <span className="font-bold">Super Admin — منارة</span>
        <a href="/dashboard" className="text-xs text-slate-300">← لوحة المعلم</a>
      </header>
      <div className="mx-auto max-w-6xl p-4 md:p-6">{children}</div>
    </div>
  );
}
