/**
 * تكاملات Google Workspace — Calendar + Sheets + Gmail بحساب جوجل الموجود.
 * لا نخزن أي أسرار: نستخدم provider_token الحي من جلسة Supabase فقط.
 * لو انتهى أو نقص scope → نطلب إعادة الربط بدل الفشل الصامت.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export type GoogleCaps = { calendar: boolean; sheets: boolean; gmail: boolean };

/** قراءة provider_token من الجلسة (خادم فقط عبر كوكيز SSR) */
export async function getProviderToken(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const { createServerClient } = await import("@supabase/ssr");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !anon) return null;
    const store = cookies();
    const supa = createServerClient(url, anon, {
      cookies: { getAll: () => store.getAll(), setAll: () => {} },
    });
    const { data } = await supa.auth.getSession();
    return data.session?.provider_token ?? null;
  } catch {
    return null;
  }
}

/** فحص الصلاحيات الممنوحة للتوكن عبر tokeninfo */
export async function googleCaps(token: string): Promise<GoogleCaps> {
  const caps: GoogleCaps = { calendar: false, sheets: false, gmail: false };
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return caps;
    const j = (await r.json()) as { scope?: string };
    const s = String(j.scope ?? "");
    caps.calendar = s.includes("calendar.events");
    caps.sheets = s.includes("spreadsheets");
    caps.gmail = s.includes("gmail.send");
  } catch {}
  return caps;
}

/** استدعاء Google API بالتوكن — يرجع {unauth:true} عند انتهاء/نقص الصلاحية */
export async function googleApi(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; unauth?: boolean; data?: any; status?: number }> {
  try {
    const r = await fetch(`https://www.googleapis.com${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    if (r.status === 401 || r.status === 403) return { ok: false, unauth: true, status: r.status };
    const data = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, data };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

/** إرسال بريد عبر Gmail API — الترميز base64url حسب توثيق جوجل */
export function buildGmailRaw(to: string, subject: string, text: string, fromName?: string): string {
  const enc = (s: string) =>
    Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const headers = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
  ].join("\r\n");
  const who = fromName ? `"${fromName}"` : "";
  void who;
  return enc(headers + Buffer.from(text, "utf8").toString("base64"));
}
