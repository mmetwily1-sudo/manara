import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function CertsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let certs: any[] = [];

  if (url && anon) {
    const store = cookies();
    const sb = createServerClient(url, anon, {
      cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => { try { store.set(name, value, options); } catch {} }); } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { data: urow } = await admin.from("users").select("id").eq("auth_user_id", user.id).single();
      if (urow) {
        const { data } = await admin.from("certificates").select("serial_code,title,score,issued_at").eq("student_id", urow.id).order("issued_at", { ascending: false }).limit(20);
        certs = data ?? [];
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-h1">شهاداتي</h1>
      {certs.length === 0 ? (
        <div className="card p-8 text-center text-small text-slate-500">لسه مفيش شهادات — حل امتحان وتفوّق للحصول على شهادتك الأولى 🎉</div>
      ) : (
        <ul className="space-y-3">
          {certs.map((c) => (
            <li key={c.serial_code} className="card flex items-center justify-between p-4">
              <div>
                <div className="text-small font-bold">{c.title}</div>
                <div className="text-xs text-slate-500">{c.score} درجات · {new Date(c.issued_at).toLocaleDateString("ar-EG")}</div>
              </div>
              <a href={`/verify/${c.serial_code}`} className="btn-secondary !px-4 !py-1.5 text-xs">عرض</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
