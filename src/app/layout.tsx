import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { PushBootstrap } from "@/components/PushBootstrap";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://manara-mmetwily.vercel.app").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "منارة — نظام تشغيل المعلم والسنتر",
    template: "%s · منارة",
  },
  description:
    "منصة تعليمية باسمك: تحضير في ثواني، تحصيل بصفر عمولة، إشعارات أولياء الأمور لحظياً، فيديوهات محمية وامتحانات بتتصحح لوحدها. جرّب 14 يوم مجاناً بدون بطاقة.",
  keywords: [
    "برنامج إدارة سنتر دروس خصوصية",
    "منصة للمعلمين",
    "منصة تعليمية مصر",
    "برنامج حضور وغياب الطلاب",
    "بنك أسئلة",
    "تصحيح امتحانات تلقائي",
    "امتحانات أونلاين مصر",
    "تحضير QR للسناتر",
    "متابعة أولياء الأمور واتساب",
    "نظام إدارة سنتر تعليمي",
  ],
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: "منارة",
    title: "منارة · صوّر الورقة.. امتحانك منشور",
    description:
      "ارفع صورة ورقة الامتحان — نفرّغها ونحلها وندققها وننشرها تلقائياً. تحضير QR، تحصيل بصفر عمولة، وإشعارات أولياء الأمور. جرّب 14 يوم مجاناً.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "منارة — منصة السناتر والمعلمين" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "منارة · صوّر الورقة.. امتحانك منشور",
    description: "تفريغ وحل وتدقيق ونشر الامتحانات تلقائياً + إدارة كاملة للسنتر. جرّب 14 يوم مجاناً.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#047857",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* TODO قبل الإنتاج: استضافة ذاتية للخط (self-host woff2) حسب taste-skill */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg font-sans text-slate-900 antialiased">
        {children}
        <FloatingWhatsApp />
        <PushBootstrap />
      </body>
    </html>
  );
}
