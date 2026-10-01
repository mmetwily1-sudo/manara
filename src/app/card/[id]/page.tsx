import { createClient } from "@supabase/supabase-js";
import { PrintButton } from "@/components/PrintButton";

/** بطاقة الطالب الرقمية — تُعرض عند الدخول + QR لرابطها */
export default async function StudentCardPage({ params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://manara-mmetwily.vercel.app";
  let st: any = null;
  let groups: string[] = [];
  let center = "";

  if (url && service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: u } = await admin.from("users").select("id,full_name,points,tenant_id")
      .eq("id", params.id).eq("role", "student").single();
    if (u) {
      st = u;
      const [{ data: enr }, { data: t }] = await Promise.all([
        admin.from("enrollments").select("groups(name)").eq("tenant_id", (u as any).tenant_id).eq("student_id", (u as any).id).eq("status", "active").limit(10),
        admin.from("tenants").select("name").eq("id", (u as any).tenant_id).single(),
      ]);
      groups = ((enr ?? []) as any[]).map((e) => (e.groups as any)?.name).filter(Boolean);
      center = (t as any)?.name ?? "";
    }
  }

  if (!st) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-h1">🪪</div>
        <h1 className="text-h1">البطاقة غير موجودة</h1>
      </main>
    );
  }

  const cardUrl = `${appUrl}/card/${params.id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cardUrl)}`;
  // رمز دائم للتحضير: يحمله المعلم ماسحاً من لوحته (بطاقة الطالب الدائمة)
  const scanPayload = `manara:student:${params.id}`;
  const qrScan = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(scanPayload)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg p-4">
      <div className="print-card card w-full max-w-sm space-y-4 p-8 text-center">
        <div className="text-xs font-bold text-slate-400">{center} · بطاقة طالب 🪪</div>
        <div className="text-h1 font-extrabold">{st.full_name}</div>
        {groups.length > 0 && <div className="text-small text-slate-500">{groups.join(" · ")}</div>}
        <div className="inline-block rounded-full bg-primary-light px-4 py-1.5 text-small font-bold text-primary">⭐ {Number(st.points ?? 0)} نقطة</div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrScan} alt="QR التحضير" width={220} height={220} className="mx-auto rounded-xl border border-slate-100" />
        </div>
        <p className="text-xs text-slate-400">اعرضها عند الدخول ليحضّرك المعلم بالمسح — أو امسح رمز الجلسة بنفسك</p>
        <div className="no-print">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
