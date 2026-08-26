import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/trial — تسجيل تجربة مجانية حقيقية
 *
 * وضعان تلقائيان:
 * - لو مفاتيح Supabase موجودة → ينشئ tenant فعلي بـ7 أيام تجربة ويرجع الـsubdomain
 * - لو مش موجودة (استضافة ثابتة/إعداد ناقص) → يرجع fallback والعميل يكمل واتساب مع تأكيد مرئي
 */

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function makeSlug(centerName: string): string {
  const latin = centerName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 20);
  const rand = Math.random().toString(36).slice(2, 6);
  return latin.length >= 3 ? `${latin}-${rand}` : `mr-${rand}`;
}

export async function POST(req: Request) {
  let body: { centerName?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const centerName = (body.centerName ?? "").trim();
  const phone = (body.phone ?? "").replace(/[^\d+]/g, "");

  if (centerName.length < 2 || phone.length < 8) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 }
    );
  }

  // وضع المعاينة/الاستضافة الثابتة — بدون مفاتيح
  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ ok: true, mode: "fallback" });
  }

  // الوضع الحقيقي — إنشاء سنتر التجربة في قاعدة البيانات
  const admin = createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = makeSlug(centerName);
    const { data, error } = await admin
      .from("tenants")
      .insert({
        name: centerName,
        slug,
        plan: "trial",
        status: "active",
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        settings: { owner_phone: phone },
      })
      .select("slug")
      .single();

    if (!error && data) {
      return NextResponse.json({
        ok: true,
        mode: "live",
        slug: data.slug,
      });
    }

    const code = (error as unknown as { code?: string })?.code;
    if (code !== "23505") {
      // خطأ غير التكرار — نسجل ونرجع fallback عشان ما نضيعش العميل أبداً
      console.error("trial insert failed:", error?.message);
      return NextResponse.json({ ok: true, mode: "fallback" });
    }
    // تكرار slug → محاولة أخرى بمفتاح جديد
  }

  return NextResponse.json({ ok: true, mode: "fallback" });
}
