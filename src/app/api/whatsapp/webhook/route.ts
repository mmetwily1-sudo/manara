import { NextResponse } from "next/server";

/**
 * Webhook واتساب الرسمي (Meta Cloud API) — تحقق + استقبال حالات التسليم.
 * يُضبط مرة واحدة في لوحة Meta برابط: <SITE>/api/whatsapp/webhook
 * يعمل لحظة وضع WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_VERIFY_TOKEN.
 */

// تحقق Meta (GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("hub.mode");
  const token = u.searchParams.get("hub.verify_token");
  const challenge = u.searchParams.get("hub.challenge") ?? "";
  const expect = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  if (mode === "subscribe" && expect && token === expect) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

// حالات التسليم والقراءة — إقرار فوري (التفاصيل في لوحة Meta؛ العداد عندنا عند الإرسال)
export async function POST() {
  return NextResponse.json({ ok: true });
}
