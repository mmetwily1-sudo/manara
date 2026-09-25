import { NextResponse } from "next/server";

/** GET /api/push/public-key — المفتاح العام للاشتراك من المتصفح (الخاص لا يغادر السيرفر) */
export async function GET() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? "";
  if (!pub) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  return NextResponse.json({ ok: true, key: pub });
}
