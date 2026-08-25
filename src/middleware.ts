import { NextResponse, type NextRequest } from "next/server";

/**
 * Tenant Middleware — يستخرج المعلم (tenant) من الـ Host
 *
 * manara.app            → الموقع التسويقي (root)
 * ahmed.manara.app      → منصة الأستاذ أحمد (tenant subdomain)
 * custom-domain.com     → دومين مخصص لمعلم (يتم البحث عنه في tenants)
 *
 * ملاحظة تطوير محلي: استخدم lvh.me بدل localhost
 * (lvh.me وكل subdomain منه بيترجعوا لـ 127.0.0.1 تلقائياً)
 */

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "manara.app";

export type TenantContext = {
  isRoot: boolean;
  /** subdomain مثل "ahmed" أو null لو root */
  slug: string | null;
  /** الدومين الكامل للطلب */
  host: string;
};

export function getTenantFromHost(host: string): TenantContext {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "lvh.me"
  ) {
    return { isRoot: true, slug: null, host: hostname };
  }

  // تطوير محلي: *.lvh.me بتوجّه لـ127.0.0.1 تلقائياً
  if (hostname.endsWith(".lvh.me")) {
    const slug = hostname.replace(/\.lvh\.me$/, "").split(".")[0];
    if (!slug || slug === "www") {
      return { isRoot: true, slug: null, host: hostname };
    }
    return { isRoot: false, slug, host: hostname };
  }

  // الدومين الرئيسي نفسه (مع أو بدون www) = الموقع التسويقي
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return { isRoot: true, slug: null, host: hostname };
  }

  // Custom domain: مش من الدومين الرئيسي → tenant مباشرة
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return { isRoot: false, slug: null, host: hostname }; // slug يتحقق من DB بالدومين الكامل
  }

  const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  const parts = sub.split(".");
  if (parts.length === 0 || !parts[0] || parts[0] === "www") {
    return { isRoot: true, slug: null, host: hostname };
  }

  return { isRoot: false, slug: parts[0], host: hostname };
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const tenant = getTenantFromHost(host);
  const { pathname } = request.nextUrl;

  // Tenant host + "/" → rewrite داخلي لصفحة المعلم
  // (App Router بيفهم paths بس — فبنعيد كتابة الطلب لـ/{slug})
  let response: NextResponse;
  if (!tenant.isRoot && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${tenant.slug ?? tenant.host}`;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  // نمرر سياق الـ tenant عبر header داخلي
  response.headers.set("x-tenant-slug", tenant.slug ?? "");
  response.headers.set("x-tenant-host", tenant.host);
  response.headers.set("x-tenant-is-root", String(tenant.isRoot));

  // حماية أمنية أساسية
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // TODO Phase 2: تحقق الـ tenant من قاعدة البيانات هنا
  // (slug غير موجود → صفحة "المنصة غير موجودة")

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
