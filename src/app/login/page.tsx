import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الدخول — منارة",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm">
        <Link href="/" className="text-h2 font-extrabold text-primary">منارة</Link>
        <h1 className="mt-4 text-h1">أهلاً بعودتك 👋</h1>
        <form className="mt-6 space-y-4" action="/api/auth/login" method="post">
          <div>
            <label htmlFor="phone" className="mb-1 block text-small font-bold">رقم الموبايل</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" required
              placeholder="01xxxxxxxxx" dir="ltr"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-right outline-none focus:border-primary" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-small font-bold">كلمة السر</label>
            <input id="password" name="password" type="password" required
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-primary" />
          </div>
          <button type="submit" className="btn-primary w-full">دخول</button>
        </form>
        <p className="mt-4 text-center text-small text-slate-500">
          أول مرة؟ <Link href="/join" className="font-bold text-primary">اعمل حسابك المجاني</Link>
        </p>
      </div>
    </main>
  );
}
