import { createHmac, randomBytes } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32encode(buf: Buffer): string {
  let out = "";
  let bits = 0;
  let val = 0;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function b32decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let val = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("bad_b32");
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

/** توليد سر جديد (20 بايت base32) */
export function newTotpSecret(): string {
  return b32encode(randomBytes(20));
}

/** هل المالك مفعل التحقق بخطوتين؟ */
export async function totpRequired(admin: any, uid: string): Promise<boolean> {
  try {
    const { data } = await admin.from("owner_secrets").select("totp_enabled").eq("user_id", uid).single();
    return !!(data as any)?.totp_enabled;
  } catch { return false; }
}

/** التحقق من الكود مقابل سر المالك (false إن لم يكن مفعلاً أو الكود خطأ) */
export async function totpOk(admin: any, uid: string, code: string): Promise<boolean> {
  try {
    const { data } = await admin.from("owner_secrets").select("totp_secret,totp_enabled").eq("user_id", uid).single();
    if (!(data as any)?.totp_enabled) return false;
    return verifyTotp((data as any).totp_secret, String(code ?? ""));
  } catch { return false; }
}
/** التحقق من كود 6 أرقام (نافذة ± خطوة 30ث) */
export function verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const key = b32decode(secret);
    const step = 30;
    const counter = Math.floor(nowMs / 1000 / step);
    for (const c of [counter - 1, counter, counter + 1]) {
      const msg = Buffer.alloc(8);
      msg.writeBigUInt64BE(BigInt(c));
      const h = createHmac("sha1", key).update(msg).digest();
      const off = h[h.length - 1] & 0x0f;
      const num = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
      if (String(num % 1_000_000).padStart(6, "0") === code) return true;
    }
    return false;
  } catch { return false; }
}
