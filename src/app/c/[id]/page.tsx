import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

/** صفحة موافقة ولي الأمر برابط موقع (uuid) — قرار واحد لا يُتراجع */
export default async function ConsentPage({ params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let c: any = null;
  if (url && service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await admin.from("parent_consents")
      .select("id,title,body,status,decided_at,users(full_name),tenants(name)")
      .eq("id", params.id).single();
    c = data;
  }
  if (!c) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-h1">📋</div>
        <h1 className="text-h1">طلب الموافقة غير موجود</h1>
      </main>
    );
  }
  async function decide(form: FormData) {
    "use server";
    const v = String(form.get("v") ?? "");
    if (!["approved", "rejected"].includes(v)) return;
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const s = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(u, s, { auth: { persistSession: false } });
    await admin.from("parent_consents").update({ status: v, decided_at: new Date().toISOString() })
      .eq("id", params.id).eq("status", "pending");
    redirect(`/c/${params.id}`);
  }
  const done = c.status !== "pending";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg p-4">
      <div className="card w-full max-w-lg space-y-4 p-8">
        <div className="text-center">
          <div className="text-4xl">📋</div>
          <h1 className="mt-2 text-h1">{c.title}</h1>
          <p className="mt-1 text-small text-slate-500">
            الطالب: {(c.users as any)?.full_name ?? "—"} · {(c.tenants as any)?.name ?? ""}
          </p>
        </div>
        {c.body && <p className="rounded-xl bg-slate-50 p-4 text-small leading-relaxed" dir="auto">{c.body}</p>}
        {done ? (
          <div className={`rounded-xl p-4 text-center font-bold ${c.status === "approved" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {c.status === "approved" ? "تمت الموافقة ✅" : "تم الرفض — تواصل مع الإدارة للتفاصيل."}
          </div>
        ) : (
          <form action={decide} className="flex gap-3">
            <button type="submit" name="v" value="approved" className="btn-primary flex-1">أوافق ✅</button>
            <button type="submit" name="v" value="rejected" className="btn-secondary flex-1">أرفض</button>
          </form>
        )}
        <p className="text-center text-xs text-slate-400">قرار واحد نهائي — يُسجل بتاريخه لدى إدارة السنتر.</p>
      </div>
    </main>
  );
}
