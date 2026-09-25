import { createClient } from "@supabase/supabase-js";
import WinbackPanel from "@/components/WinbackPanel";

export default async function AdminTenantsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let tenants: any[] = [];

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin.from("tenants").select("id,name,slug,plan,status,created_at").order("created_at", { ascending: false }).limit(50);
    tenants = data ?? [];
  }

  return (
    <div className="space-y-4">
      <h1 className="text-h1">السناتر</h1>
      <WinbackPanel />
      <div className="card overflow-hidden">
        <table className="w-full text-right text-small">
          <thead className="bg-slate-900 text-xs text-slate-300">
            <tr>{["الاسم", "الـslug", "الباقة", "الحالة", "تاريخ الإنشاء"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">لا توجد سناتر بعد</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-bold">{t.name}</td>
                <td className="px-4 py-3 font-mono text-xs" dir="ltr">{t.slug}</td>
                <td className="px-4 py-3">{t.plan}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{t.status}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString("ar-EG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
