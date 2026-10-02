import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /auth/callback — عودة OAuth من جوجل (وغيره).
 * تبادل الكود خادمياً (كوكيز httpOnly للطرف الأول) بدل الاعتماد على المتصفح —
 * هذا ما يجعل الدخول يعمل على سفاري iOS رغم ITP.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const err = u.searchParams.get("error_description") ?? u.searchParams.get("error");
  const base = `${u.protocol}//${u.host}`;
  const store = cookies();

  if (err) {
    return NextResponse.redirect(`${base}/login?oauth_err=${encodeURIComponent("رفض التفويض — حاول تاني")}`, 302);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/login?oauth_err=${encodeURIComponent("عودة غير صالحة — حاول تاني")}`, 302);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) {
    return NextResponse.redirect(`${base}/login?oauth_err=${encodeURIComponent("الخدمة غير مهيأة")}`, 302);
  }

  const res = NextResponse.redirect(`${base}/login?oauth=1`, 302);
  const supa = createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cs: any[]) => {
        cs.forEach(({ name, value, options }: any) => {
          try {
            res.cookies.set(name, value, options);
            store.set(name, value, options);
          } catch {}
        });
      },
    },
  });
  const { error } = await supa.auth.exchangeCodeForSession(code);
  if (error) {
    const m = (error.message ?? "").toLowerCase();
    const ar = m.includes("expired") || m.includes("invalid")
      ? "انتهت صلاحية رابط جوجل — حاول تاني"
      : "تعذر إتمام دخول جوجل — حاول تاني";
    return NextResponse.redirect(`${base}/login?oauth_err=${encodeURIComponent(ar)}`, 302);
  }
  try {
    const { data } = await supa.auth.getSession();
    const em = (data.session?.user?.email ?? "").toLowerCase();
    if (em) {
      res.cookies.set("manara_last_email", em, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
    }
  } catch {}
  return res;
}
