import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ابدأ تجربتك المجانية — منارة",
};

export default function JoinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg px-4 py-16">
      <div className="card w-full max-w-md">
        <Link href="/" className="text-h2 font-extrabold text-primary">منارة</Link>
        <h1 className="mt-4 text-h1">جهّز سنترك في دقيقتين</h1>
        <p className="mt-2 text-body text-slate-600">
          7 أيام مجاناً — كل الأدوات مفتوحة، بدون بطاقة ائتمان.
          ولو مناسبكش مش هتدفع حاجة.
        </p>

        <form className="mt-6 space-y-4" action="/api/trial" method="post">
          <div>
            <label htmlFor="centerName" className="mb-1 block text-small font-bold">
              اسم سنترك أو اسمك كمدرس
            </label>
            <input
              id="centerName"
              name="centerName"
              required
              placeholder="مثال: سنتر النور"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none transition focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-small font-bold">
              رقم موبايلك
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              required
              placeholder="01xxxxxxxxx"
              dir="ltr"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-right outline-none transition focus:border-primary"
            />
            <p className="mt-1 text-xs text-slate-400">هنبعتلك كود تأكيد على الرقم ده</p>
          </div>
          <button type="submit" className="btn-primary w-full text-lg">
            ابدأ دلوقتي مجاناً 🚀
          </button>
        </form>

        <p className="mt-4 text-center text-small text-slate-500">
          عندك حساب؟{" "}
          <Link href="/login" className="font-bold text-primary">ادخل من هنا</Link>
        </p>
      </div>
    </main>
  );
}
