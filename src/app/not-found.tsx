import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl font-extrabold text-primary/20">404</div>
      <h1 className="mt-4 text-h1">الصفحة دي مش موجودة</h1>
      <p className="mt-2 max-w-sm text-body text-slate-500">
        يمكن الرابط قديم أو فيه غلطة في الكتابة.
        لو كنت بتدور على منصة معلم معين — اتأكد من عنوان المنصة الصح.
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/" className="btn-primary">الرئيسية</Link>
        <Link href="/join" className="btn-secondary">اعمل منصتك المجانية</Link>
      </div>
    </main>
  );
}
