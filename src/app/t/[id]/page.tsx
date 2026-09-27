import { createClient } from "@supabase/supabase-js";
import BookingForm from "@/components/BookingForm";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `صفحة معلم — منارة` };
}

/** صفحة المعلم العامة: مجموعاته + تواصل — قناة نمو يشاركها المعلم */
export default async function TeacherPage({ params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let teacher: any = null;
  let groups: any[] = [];
  let center: any = null;

  if (url && service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: u } = await admin.from("users").select("id,full_name,tenant_id,role")
      .eq("id", params.id).in("role", ["teacher_admin", "supervisor", "assistant"]).single();
    if (u) {
      teacher = u;
      const [{ data: gs }, { data: t }] = await Promise.all([
        admin.from("groups").select("id,name,grade_level,subject,monthly_fee").eq("tenant_id", (u as any).tenant_id).limit(20),
        admin.from("tenants").select("name,settings").eq("id", (u as any).tenant_id).single(),
      ]);
      groups = (gs ?? []) as any[];
      center = t;
    }
  }

  if (!teacher) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-h1">👨‍🏫</div>
        <h1 className="text-h1">صفحة المعلم غير موجودة</h1>
      </main>
    );
  }

  const first = String((teacher as any).full_name ?? "معلم").split(/\s+/)[0];
  const phone = String((center as any)?.settings?.owner_phone ?? "").replace(/[^\d]/g, "");
  const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`أهلاً ${first} 👋 عايز أستفسر عن مجموعات ${(center as any)?.name ?? ""}`)}` : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg p-4">
      <div className="card w-full max-w-lg space-y-4 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">👨‍🏫</div>
        <div>
          <h1 className="text-h1">مستر {first}</h1>
          <p className="mt-1 text-small text-slate-500">{(center as any)?.name ?? "منارة"}</p>
        </div>
        {groups.length > 0 && (
          <ul className="space-y-2 text-right">
            {groups.map((g: any) => (
              <li key={g.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span className="font-bold">{g.name} <span className="font-normal text-slate-400">· {g.grade_level ?? ""} {g.subject ?? ""}</span></span>
                {g.monthly_fee ? <span className="font-extrabold text-primary">{Number(g.monthly_fee).toLocaleString("ar-EG")} ج</span> : null}
              </li>
            ))}
          </ul>
        )}
        <BookingForm
          teacherId={params.id}
          groups={(groups ?? []).map((g: any) => ({ id: g.id, name: `${g.name}${g.grade_level ? ` · ${g.grade_level}` : ""}` }))}
        />
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="block w-full text-center text-xs font-bold text-slate-400">أو استفسر واتساب مباشرة 💬</a>}
        <p className="text-xs text-slate-400">مدعوم بمنصة منارة 🚀</p>
      </div>
    </main>
  );
}
