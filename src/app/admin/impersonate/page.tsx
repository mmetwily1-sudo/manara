import { createClient } from "@supabase/supabase-js";

/** المتابعة بعين العميل: اختر طالباً وادخل بوابته أو تقدمه (مسجل في التدقيق). */
export default async function ImpersonatePage({ searchParams }: { searchParams: { tid?: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let tenants: any[] = [];
  let students: any[] = [];
  const tid = searchParams?.tid ?? "";

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: t } = await admin.from("tenants").select("id,name").order("created_at", { ascending: false }).limit(100);
    tenants = (t ?? []) as any[];
    if (tid) {
      const { data: s } = await admin.from("users").select("id,full_name,phone").eq("tenant_id", tid).eq("role", "student").order("created_at", { ascending: false }).limit(100);
      students = (s ?? []) as any[];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">المتابعة بعين العميل 👁️</h1>
        <p className="mt-1 text-small text-slate-500">ادخل بوابة ولي الأمر أو تقدم الطالب لأي سنتر — كل دخول مسجل في التدقيق لمدة 24 ساعة.</p>
      </div>

      <form method="get" className="card flex flex-wrap gap-2 p-4">
        <select name="tid" defaultValue={tid} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-small">
          <option value="">اختر السنتر…</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn-primary !px-5 !py-2 text-small">عرض الطلاب</button>
      </form>

      {tid && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-right text-small">
              <thead className="bg-slate-900 text-xs text-slate-300">
                <tr><th className="px-4 py-3 font-semibold">الطالب</th><th className="px-4 py-3 font-semibold">الموبايل</th><th className="px-4 py-3 font-semibold">دخول</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">لا طلاب في هذا السنتر</td></tr>
                )}
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-bold">{s.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a href={`/api/admin/impersonate?student_id=${s.id}&to=parent`} className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary">ولي الأمر</a>
                        <a href={`/api/admin/impersonate?student_id=${s.id}&to=progress`} className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary">الطالب</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
