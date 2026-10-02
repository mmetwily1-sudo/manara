/**
 * قناة تليجرام — بوت واحد للمنصة كلها، إرسال مجاني غير محدود (Bot API رسمية).
 * الربط: ولي الأمر يضغط /start في البوت بكود سنتره → نخزن chat_id.
 * لا أسرار في العميل أبداً — التوكن على السيرفر فقط.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const BOTNAME = process.env.TELEGRAM_BOT_USERNAME ?? "";

export function isTelegramLive(): boolean {
  return TOKEN.length > 20;
}

export function botUsername(): string {
  return BOTNAME;
}

/** رابط الربط العميق لطالب: t.me/<bot>?start=u_<userId> */
export function telegramLinkFor(userId: string): string | null {
  if (!BOTNAME) return null;
  return `https://t.me/${BOTNAME}?start=u_${userId}`;
}

export type TgResult = { ok: true } | { ok: false; reason: string };

export async function sendTelegram(chatId: number | string, text: string): Promise<TgResult> {
  if (!isTelegramLive()) return { ok: false, reason: "not_configured" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as any;
      const desc = String(j?.description ?? "");
      if (/blocked|deactivated|not found|chat not found/i.test(desc)) return { ok: false, reason: "blocked" };
      return { ok: false, reason: "send_failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "conn" };
  }
}
