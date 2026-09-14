import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpInfo, findAuthUserByEmail, getPasskeys, setUserMeta } from "@/lib/webauthn";

/** بدء الدخول بالبصمة — عام، يحتاج البريد فقط */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    // لا نكشف عدم وجود الحساب — نفس رسالة الفشل العامة
    return NextResponse.json({ ok: false, error: "no_passkeys" }, { status: 404 });
  }

  const list = await getPasskeys(authUser.id);
  if (!list.length) {
    return NextResponse.json({ ok: false, error: "no_passkeys" }, { status: 404 });
  }

  const { rpID } = rpInfo();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: list.map((c) => ({ id: c.id, transports: (c.transports ?? []) as any })),
    userVerification: "preferred",
  });

  await setUserMeta(authUser.id, { webauthn_auth_challenge: options.challenge });
  return NextResponse.json({ ok: true, options });
}
