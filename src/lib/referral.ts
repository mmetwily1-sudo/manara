import { createHash } from "crypto";

/** بصمة هاتف المُحال (لمنع تكرار نفس الشخص عبر سناتر) — تُخزّن hash فقط */
export function phoneHash(phone: string): string {
  return createHash("sha256").update("refphone:" + String(phone ?? "").replace(/[^\d+]/g, "")).digest("hex");
}
