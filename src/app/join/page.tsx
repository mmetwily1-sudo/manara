import Link from "next/link";
import type { Metadata } from "next";
import { TrialForm } from "@/components/TrialForm";
import { InAppGuard } from "@/components/InAppGuard";

export const metadata: Metadata = {
  title: "ابدأ تجربتك المجانية — منارة",
};

export default function JoinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-light/40 to-bg px-4 py-16">
      <div className="card w-full max-w-md p-8">
        <Link href="/" className="text-h2 font-extrabold text-primary">منارة</Link>
        <h1 className="mt-4 text-h1">جهّز سنترك في دقيقتين</h1>
        <p className="mt-2 text-body text-slate-600">
          14 يوم مجاناً — كل الأدوات مفتوحة، بدون بطاقة ائتمان.
          ولو مناسبكش مش هتدفع حاجة.
        </p>

        <TrialForm />
        <div className="mt-4"><InAppGuard /></div>

        <p className="mt-4 text-center text-small text-slate-500">
          عندك حساب؟{" "}
          <Link href="/login" className="font-bold text-primary">ادخل من هنا</Link>
        </p>
      </div>
    </main>
  );
}
