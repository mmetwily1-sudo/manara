import { createClient } from "@supabase/supabase-js";
import ShareCert from "@/components/ShareCert";

export async function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `شهادة ${params.code} — منارة` };
}

export default async function VerifyPage({ params }: { params: { code: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let cert: any = null;

  if (url && service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data } = await admin.from("certificates").select("serial_code,title,score,issued_at,tenants(name),users(full_name)").eq("serial_code", params.code).single();
    cert = data;
  }

  if (!cert) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-h1">🔍</div>
        <h1 className="text-h1">الشهادة غير موجودة</h1>
        <p className="text-small text-slate-500">تأكد من الرمز: <span className="font-mono" dir="ltr">{params.code}</span></p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg p-4">
      <div className="card max-w-lg w-full p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-xl">🎓</div>
        <h1 className="mt-4 text-h1">{cert.title}</h1>
        <p className="mt-1 text-small text-slate-500">
          {(cert.users as any)?.full_name ?? "طالب"} · {(cert.tenants as any)?.name ?? "منارة"} · {(cert.score ?? 0).toString()} درجات
        </p>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 font-mono text-small font-bold" dir="ltr">{cert.serial_code}</div>
        <p className="mt-2 text-xs text-slate-400">صدرت: {new Date(cert.issued_at).toLocaleDateString("ar-EG")}</p>
        <div className="mt-4 rounded-lg bg-success/5 px-3 py-2 text-xs font-semibold text-success">✓ شهادة موثقة — تحقق عبر رمز QR</div>
        <ShareCert title={cert.title} name={(cert.users as any)?.full_name ?? "طالب"} center={(cert.tenants as any)?.name ?? "منارة"} />
      </div>
    </main>
  );
}
