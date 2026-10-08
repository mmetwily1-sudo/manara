import { createClient } from "@supabase/supabase-js";
import { ChainsManager } from "@/components/ChainsManager";

export default async function AdminChainsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let chains: any[] = [];
  let unassignedTenants: any[] = [];

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const [{ data: chainRows }, { data: freeTenants }] = await Promise.all([
      admin.from("chains").select("id,name,owner_user_id,created_at,tenants(id,name,slug,status,plan)").order("created_at", { ascending: false }),
      admin.from("tenants").select("id,name,slug,owner_user_id").is("chain_id", null).order("name"),
    ]);
    chains = chainRows ?? [];
    unassignedTenants = (freeTenants ?? []).filter((t: any) => t.owner_user_id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1">السلاسل والفرنشايز</h1>
        <p className="mt-1 text-small text-slate-500">
          إدارة مالك يشرف على عدة فروع (سناتر) كعلامة تجارية واحدة — تقرير مجمّع بلا دخول فرعاً فرعاً.
        </p>
      </div>
      <ChainsManager initialChains={chains} unassignedTenants={unassignedTenants} />
    </div>
  );
}
