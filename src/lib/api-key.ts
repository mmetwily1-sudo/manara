import { createHash } from "node:crypto";
import { adminClient } from "./server-auth";

/** التحقق من مفتاح API عام: يرجع tenant_id أو null (ويحدث آخر استخدام) */
export async function verifyApiKey(raw: string): Promise<string | null> {
  try {
    if (!raw || !raw.startsWith("mk_")) return null;
    const admin = adminClient();
    const hash = createHash("sha256").update(raw).digest("hex");
    const { data: k } = await admin.from("api_keys").select("id,tenant_id,revoked")
      .eq("key_hash", hash).single();
    if (!k || (k as any).revoked) return null;
    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", (k as any).id);
    return (k as any).tenant_id as string;
  } catch { return null; }
}
