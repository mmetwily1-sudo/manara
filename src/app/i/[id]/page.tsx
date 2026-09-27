import { createClient } from "@supabase/supabase-js";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `إيصال ${params.id.slice(0, 8)} — منارة` };
}

/** صفحة إيصال عامة برابط مشاركة (uuid غير قابل للتخمين) — للاطلاع فقط */
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let p: any = null;

  if (url && service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await admin.from("payments")
      .select("id,amount,method,paid_at,receipt_no,tenants(name),users(full_name)")
      .eq("id", params.id).single();
    p = data;
  }

  if (!p) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-h1">🧾</div>
        <h1 className="text-h1">الإيصال غير موجود</h1>
        <p className="text-small text-slate-500">تأكد من الرابط المرسل من إدارة السنتر.</p>
      </main>
    );
  }

  const METHODS: Record<string, string> = { cash: "كاش", wallet: "محفظة", instapay: "انستاباي", card: "بطاقة", fawry: "فوري" };
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg p-4">
      <div className="card w-full max-w-lg space-y-4 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-xl">🧾</div>
        <div>
          <h1 className="text-h1">إيصال استلام</h1>
          <p className="mt-1 text-small text-slate-500">{(p.tenants as any)?.name ?? "منارة"}</p>
        </div>
        <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-small">
          <div className="flex justify-between"><dt className="text-slate-500">الطالب</dt><dd className="font-bold">{(p.users as any)?.full_name ?? "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">المبلغ</dt><dd className="font-extrabold text-success">{Number(p.amount ?? 0).toLocaleString("ar-EG")} جنيه</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">الطريقة</dt><dd className="font-bold">{METHODS[p.method] ?? p.method}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">رقم الإيصال</dt><dd className="font-mono font-bold" dir="ltr">{p.receipt_no != null ? `#${p.receipt_no}` : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">التاريخ</dt><dd className="font-bold">{new Date(p.paid_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
        </dl>
        <p className="text-xs text-slate-400">✓ إيصال موثق من نظام السنتر — للاستفسار تواصل مع الإدارة</p>
      </div>
    </main>
  );
}
