/** @type {import('next').NextConfig} */
// EXPORT_MODE=1 → تصدير ثابت للـGitHub Pages (معاينة لايف بدون سيرفر)
const isExport = process.env.EXPORT_MODE === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // صفحة المساعد القديمة أُدمجت في الودجت العائم — لا 404 للروابط المحفوظة
      { source: "/dashboard/agent", destination: "/dashboard", permanent: false },
      { source: "/dashboard/agent/:path*", destination: "/dashboard", permanent: false },
    ];
  },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(isExport ? { output: "export", images: { unoptimized: true } } : {
    images: {
      // نطاق واحد فقط مستخدم فعلياً — تضييق السطح يقلل مخاطر Image Optimizer
      remotePatterns: [
        { protocol: "https", hostname: "**.supabase.co" },
      ],
    },
  }),
};

export default nextConfig;
