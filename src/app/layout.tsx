import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";

export const metadata: Metadata = {
  title: "منارة — نظام تشغيل المعلم والسنتر",
  description:
    "منصة تعليمية باسمك: تحضير في ثواني، تحصيل بصفر عمولة، إشعارات أولياء الأمور لحظياً، فيديوهات محمية وامتحانات بتتصحح لوحدها. جرّب 7 أيام مجاناً بدون بطاقة.",
  keywords: [
    "برنامج إدارة سنتر دروس خصوصية",
    "منصة للمعلمين",
    "منصة تعليمية مصر",
    "برنامج حضور وغياب الطلاب",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
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
      </body>
    </html>
  );
}
