import { headers } from "next/headers";
import { adminClient } from "./server-auth";

export type StoredPasskey = {
  id: string;
  publicKey: string; // base64url
  counter: number;
  transports?: string[];
  name: string;
  createdAt: string;
};

/** اسم المضيف والمنشأ الفعلي للطلب (يعمل محلياً وعلى Vercel) */
export function rpInfo() {
  const host = (headers().get("host") ?? "localhost:3000").split(":")[0];
  const proto =
    host === "localhost" || host === "127.0.0.1" ? "http" : "https";
  return { rpID: host, origin: `${proto}://${headers().get("host") ?? host}` };
}

export async function getUserMeta(authUserId: string): Promise<Record<string, any>> {
  const admin = adminClient();
  const { data } = await admin.auth.admin.getUserById(authUserId);
  return (data?.user?.user_metadata ?? {}) as Record<string, any>;
}

export async function setUserMeta(authUserId: string, patch: Record<string, any>) {
  const admin = adminClient();
  const current = await getUserMeta(authUserId);
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    user_metadata: { ...current, ...patch },
  });
  if (error) throw new Error(error.message);
}

export async function getPasskeys(authUserId: string): Promise<StoredPasskey[]> {
  const meta = await getUserMeta(authUserId);
  return Array.isArray(meta.webauthn) ? (meta.webauthn as StoredPasskey[]) : [];
}

export async function savePasskeys(authUserId: string, list: StoredPasskey[]) {
  await setUserMeta(authUserId, { webauthn: list });
}

/** البحث عن مستخدم بالبريد (لقاعدة مستخدمين صغيرة/متوسطة) */
export async function findAuthUserByEmail(email: string) {
  const admin = adminClient();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find(
      (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 25) return null; // سقف أمان
  }
}
