import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

/**
 * Webhook بوت المنصة: ولي الأمر يضغط /start u_<userId> في تليجرام → نربط chat_id بحسابه.
 * يُضبط مرة واحدة: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SITE>/api/telegram/webhook
 */
export async function POST(req: Request) {
  if (SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (got !== SECRET) return NextResponse.json({ ok: false }, { status: 403 });
  }
  const update = await req.json().catch(() => null as any);
  const msg = update?.message;
  const chatId = msg?.chat?.id as number | undefined;
  const text = String(msg?.text ?? "").trim();
  if (!chatId || !SUPA_URL || !SERVICE) return NextResponse.json({ ok: true });
  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

  const m = text.match(/^\/start\s+u_([0-9a-f-]{10,50})/i);
  if (m) {
    const userId = m[1];
    const { data: urow } = await admin.from("users").select("id,tenant_id,full_name").eq("id", userId).limit(1).single();
    if ((urow as any)?.id) {
      await admin.from("telegram_links").upsert(
        { tenant_id: (urow as any).tenant_id, user_id: (urow as any).id, chat_id: chatId },
        { onConflict: "tenant_id,user_id" }
      );
      await reply(`تم ربط تليجرام بنجاح ✅\n${(urow as any).full_name ?? ""}\nستصلك تنبيهات الغياب والنتائج والمصروفات هنا مجاناً.`);
      return NextResponse.json({ ok: true, linked: true });
    }
    await reply("كود الربط غير صحيح — انسخ رابط الربط من بوابة ولي الأمر وحاول تاني.");
    return NextResponse.json({ ok: true, linked: false });
  }
  if (text === "/start") {
    await reply("أهلاً بك في منارة 👋\nلربط حسابك: افتح بوابة ولي الأمر ← قسم تليجرام ← اضغط زر الربط.");
  }
  return NextResponse.json({ ok: true });

  async function reply(t: string) {
    if (!TOKEN) return;
    try {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: t.slice(0, 1000) }),
      });
    } catch {}
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, live: TOKEN.length > 20 });
}
