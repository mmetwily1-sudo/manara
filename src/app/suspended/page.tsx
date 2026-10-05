import Link from "next/link";

/** شاشة الإيقاف — تُعرض لطاقم/طلاب السنتر الموقوف بدل أي محتوى */
export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
      <div className="text-h1">⏸️</div>
      <h1 className="text-h1">الحساب موقوف مؤقتاً</h1>
      <p className="max-w-sm text-small leading-relaxed text-slate-500">
        تم إيقاف حساب هذا السنتر مؤقتاً من إدارة المنصة — للاستفسار أو السداد تواصل معنا وسنعيد التفعيل فوراً.
      </p>
      <Link href="/login" className="btn-primary !px-6 !py-2.5 text-small">رجوع للدخول</Link>
    </main>
  );
}
